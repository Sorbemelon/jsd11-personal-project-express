import Chunk from "../../models/Chunk.model.js";
import { AppError } from "../../utils/error.js";
import { transformFileToChunks } from "./file.transformer.js";
import { uploadToS3 } from "../../utils/s3.js";
import { embedText } from "../embeddings/embedding.service.js";

/**
 * GET /files
 */
export const listFiles = async (userId) => {
  return Chunk.find({
    userId,
    type: "file",
    isDeleted: false,
  }).sort({ createdAt: -1 });
};

/**
 * GET /files/:id
 */
export const getFileById = async (userId, fileId) => {
  const file = await Chunk.findOne({
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
 * POST /files/upload
 * Upload → transform → auto-embed
 */
export const uploadFile = async ({ userId, file, parentId }) => {
  if (!file) {
    throw new AppError("No file uploaded", 400);
  }

  /* ---------- OPTIONAL: validate parent folder ---------- */
  if (parentId) {
    const folder = await Chunk.findOne({
      _id: parentId,
      userId,
      type: "folder",
      isDeleted: false,
    });

    if (!folder) {
      throw new AppError("Target folder not found", 404);
    }
  }

  /* ---------- 1️⃣ Upload file to S3 ---------- */
  const s3Result = await uploadToS3({
    buffer: file.buffer,
    mimeType: file.mimetype,
    originalName: file.originalname,
    userId,
  });

  /* ---------- 2️⃣ Transform file → JSON + text ---------- */
  const transformed = await transformFileToChunks(file);
  // {
  //   content: "normalized text",
  //   rawJson: {...},
  //   chunks: [{ content: "..." }]
  // }

  /* ---------- 3️⃣ Create FILE chunk ---------- */
  const fileChunk = await Chunk.create({
    userId,
    type: "file",
    name: file.originalname,
    parentId: parentId || null,

    mimeType: file.mimetype,
    size: file.size,

    content: transformed.content,
    rawJson: transformed.rawJson,

    storage: {
      provider: "s3",
      uri: s3Result.url,
      key: s3Result.key,
    },

    isDeleted: false,
  });

  /* ---------- 4️⃣ Create TEXT chunks + embeddings ---------- */
  if (transformed.chunks?.length) {
    for (let index = 0; index < transformed.chunks.length; index++) {
      const chunk = transformed.chunks[index];

      // 🔹 embed each chunk
      const embedding = await embedText(chunk.content);

      await Chunk.create({
        userId,
        type: "chunk",
        parentId: fileChunk._id,
        name: `${file.originalname} #${index + 1}`,
        content: chunk.content,
        order: index,
        embedding,
        isDeleted: false,
        metadata: {
          sourceFile: fileChunk._id,
        },
      });
    }
  }

  return fileChunk;
};

/**
 * PATCH /files/:id/move
 */
export const moveFile = async ({ userId, fileId, targetFolderId }) => {
  const file = await getFileById(userId, fileId);

  if (targetFolderId) {
    const folder = await Chunk.findOne({
      _id: targetFolderId,
      userId,
      type: "folder",
      isDeleted: false,
    });

    if (!folder) {
      throw new AppError("Target folder not found", 404);
    }
  }

  file.parentId = targetFolderId || null;
  await file.save();

  return file;
};

/**
 * DELETE /files/:id
 */
export const deleteFile = async (userId, fileId) => {
  const file = await getFileById(userId, fileId);

  file.isDeleted = true;
  await file.save();

  // cascade soft-delete child chunks
  await Chunk.updateMany(
    { parentId: file._id },
    { $set: { isDeleted: true } }
  );
};
