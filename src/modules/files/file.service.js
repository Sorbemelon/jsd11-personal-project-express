import crypto from "crypto";
import path from "path";
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
 * Generate a collision-safe filename using numeric suffix
 * Example:
 *   report.pdf
 *   report (1).pdf
 *   report (2).pdf
 */
const generateUniqueFileName = async ({
  userId,
  parentId,
  originalName,
}) => {
  const ext = path.extname(originalName);
  const base = path.basename(originalName, ext);

  // 1️⃣ If original name doesn't exist → use it directly
  const originalExists = await Item.exists({
    userId,
    parentId: parentId || null,
    name: originalName,
    type: "file",
    isDeleted: false,
  });

  if (!originalExists) {
    return originalName;
  }

  // 2️⃣ Find next available numeric suffix
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
export const uploadFile = async ({
  userId,
  file,
  parentId = null,
}) => {
  if (!file) {
    throw new AppError("No file uploaded", 400);
  }

  /* ---------- resolve parent folder & S3 key ---------- */
  let folderKey = "";

  if (parentId) {
    const folder = await Item.findOne({
      _id: parentId,
      userId,
      type: "folder",
      isDeleted: false,
    });

    if (!folder) {
      throw new AppError("Target folder not found", 404);
    }

    folderKey = folder.storage?.key || "";
  }

  /* ---------- resolve unique filename ---------- */
  const safeFileName = await generateUniqueFileName({
    userId,
    parentId,
    originalName: file.originalname,
  });

  /* ---------- upload to S3 ---------- */
  const s3Result = await uploadToS3({
    buffer: file.buffer,
    mimeType: file.mimetype,
    filename: safeFileName,
    folderKey, // ✅ ALWAYS A STRING
  });

  /* ---------- transform file ---------- */
  const transformed = await transformFileToChunks(file);

  /* ---------- create FILE chunk ---------- */
  const fileChunk = await Item.create({
    userId,
    type: "file",
    name: safeFileName,
    parentId,

    mimeType: file.mimetype,
    size: file.size,

    rawJson: transformed.rawJson,

    storage: {
      provider: "s3",
      key: s3Result.key,
      uri: s3Result.url,
    },

    isDeleted: false,
  });

  /* ---------- create TEXT chunks ---------- */
  if (transformed.chunks?.length) {
    for (let i = 0; i < transformed.chunks.length; i++) {
      const chunk = transformed.chunks[i];
      const embedding = await embedText(chunk.content);

      await Chunk.create({
        userId,
        itemId: fileChunk._id,
        name: `${safeFileName} #${i + 1}`,
        content: chunk.content,
        order: i,
        embedding,
        isDeleted: false,
      });
    }
  }

  return fileChunk;
};

/**
 * GET /files
 */
export const listFiles = async ({ userId }) => {
  return Item.find({
    userId,
    type: "file",
    isDeleted: false,
  }).sort({ createdAt: -1 });
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

  if (!file) {
    throw new AppError("File not found", 404);
  }

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

    if (!folder) {
      throw new AppError("Target folder not found", 404);
    }

    // ⚠️ NOTE:
    // storage.key is NOT updated here
    // S3 move can be implemented later if needed
  }

  file.parentId = targetFolderId || null;
  await file.save();

  return file;
};

/**
 * DELETE /files/:id
 * Hard delete (MongoDB + S3)
 */
export const deleteFile = async (userId, fileId) => {
  const file = await Item.findOne({
    _id: fileId,
    userId,
    type: "file",
  });

  // ✅ Idempotent: already gone
  if (!file) {
    return { success: true };
  }

  /* ---------- delete from S3 first ---------- */
  const key = file.storage?.key;
  if (key) {
    try {
      await deleteFromS3(key);
    } catch (err) {
      console.error("S3 delete failed:", key, err.message);
      throw new AppError("Failed to delete file from storage", 500);
    }
  }

  /* ---------- delete text chunks ---------- */
  await Chunk.deleteMany({
    itemId: file._id,
  });

  /* ---------- delete file document ---------- */
  await Item.deleteOne({ _id: file._id });

  return { success: true };
};
