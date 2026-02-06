import crypto from "crypto";
import path from "path";
import slugify from "slugify";
import Item from "../../models/Item.model.js";
import Chunk from "../../models/Chunk.model.js";
import { AppError } from "../../utils/error.js";
import { transformFileToChunks } from "./file.transformer.js";
import { uploadToS3, deleteFromS3 } from "../../utils/s3.js";
import { embedText } from "../embeddings/embedding.service.js";

/* ======================================================
   Helpers
====================================================== */

/**
 * Convert filename → safe storage key (keeps extension)
 */
const toSafeStorageName = (name) => {
  const ext = path.extname(name);
  const base = path.basename(name, ext);

  const safeBase =
    slugify(base, { lower: true, strict: true, trim: true }) ||
    crypto.randomBytes(6).toString("hex");

  return `${safeBase}${ext}`;
};

/**
 * Generate collision-safe filename using numeric suffix
 */
const generateUniqueFileName = async ({ userId, parentId, originalName }) => {
  const ext = path.extname(originalName);
  const base = path.basename(originalName, ext);

  const originalExists = await Item.exists({
    userId,
    parentId: parentId || null,
    name: originalName,
    type: "file",
    isDeleted: false,
  });

  if (!originalExists) return originalName;

  let counter = 1;
  let filename;

  while (true) {
    filename = `${base} (${counter})${ext}`;

    const exists = await Item.exists({
      userId,
      parentId: parentId || null,
      name: filename,
      type: "file",
      isDeleted: false,
    });

    if (!exists) break;
    counter++;
  }

  return filename;
};

/* ======================================================
   Service
====================================================== */

/**
 * POST /files/upload
 */
export const uploadFile = async ({ userId, file, parentId = null }) => {
  if (!file) throw new AppError("No file uploaded", 400);

  /* ---------- resolve parent folder ---------- */
  let folderKey = "";

  if (parentId) {
    const folder = await Item.findOne({
      _id: parentId,
      userId,
      type: "folder",
      isDeleted: false,
    });

    if (!folder) throw new AppError("Target folder not found", 404);

    folderKey = folder.storage?.key || "";
  }

  /* ---------- resolve display filename ---------- */
  const displayName = await generateUniqueFileName({
    userId,
    parentId,
    originalName: file.originalname,
  });

  /* ---------- resolve safe storage filename ---------- */
  const safeStorageName = toSafeStorageName(displayName);

  /* ---------- upload to S3 ---------- */
  const s3Result = await uploadToS3({
    buffer: file.buffer,
    mimeType: file.mimetype,
    filename: safeStorageName,
    folderKey,
  });

  /* ---------- transform file ---------- */
  const transformed = await transformFileToChunks(file);

  /* ---------- create FILE item ---------- */
  const fileItem = await Item.create({
    userId,
    type: "file",
    name: displayName, // original Thai-safe name for UI
    parentId,

    mimeType: file.mimetype,
    size: file.size,

    rawJson: transformed.rawJson,

    storage: {
      provider: "s3",
      key: s3Result.key,
      uri: s3Result.url,
      originalName: file.originalname,
    },

    isDeleted: false,
  });

  /* ---------- create TEXT chunks ---------- */
  if (transformed.chunks?.length) {
    const chunkDocs = [];

    for (let i = 0; i < transformed.chunks.length; i++) {
      const chunk = transformed.chunks[i];
      const embedding = await embedText(chunk.content);

      chunkDocs.push({
        userId,
        itemId: fileItem._id,
        name: `${displayName} #${i + 1}`,
        content: chunk.content,
        order: i,
        embedding,
        isDeleted: false,
      });
    }

    await Chunk.insertMany(chunkDocs);
  }

  return fileItem;
};

/**
 * GET /files
 */
export const listFiles = async ({ userId }) => {
  return Item.find({ userId, type: "file", isDeleted: false }).sort({ createdAt: -1 });
};

/**
 * GET /files/:id
 */
export const getFileById = async ({ userId, fileId }) => {
  const file = await Item.findOne({
    _id: fileId,
    userId,
    type: "file",
    isDeleted: false,
  });

  if (!file) throw new AppError("File not found", 404);

  return file;
};

/**
 * PATCH /files/:id/move
 */
export const moveFile = async ({ userId, fileId, targetFolderId }) => {
  const file = await getFileById({ userId, fileId });

  if (targetFolderId) {
    const folder = await Item.findOne({
      _id: targetFolderId,
      userId,
      type: "folder",
      isDeleted: false,
    });

    if (!folder) throw new AppError("Target folder not found", 404);
  }

  file.parentId = targetFolderId || null;
  await file.save();

  return file;
};

/**
 * DELETE /files/:id
 */
export const deleteFile = async (userId, fileId) => {
  const file = await Item.findOne({ _id: fileId, userId, type: "file" });

  if (!file) return { success: true };

  const key = file.storage?.key;

  if (key) {
    try {
      await deleteFromS3(key);
    } catch (err) {
      console.error("S3 delete failed:", key, err.message);
      throw new AppError("Failed to delete file from storage", 500);
    }
  }

  await Chunk.deleteMany({ itemId: file._id });
  await Item.deleteOne({ _id: file._id });

  return { success: true };
};