import Chunk from "../../models/Chunk.model.js";
import { AppError } from "../../utils/error.js";
import { transformFileToChunks } from "./file.transformer.js";

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
 */
export const uploadFile = async ({ userId, file, folderId }) => {
  if (!file) {
    throw new AppError("No file uploaded", 400);
  }

  // 1️⃣ Create FILE chunk
  const fileChunk = await Chunk.create({
    userId,
    type: "file",
    name: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    storagePath: file.path,
    parentId: folderId || null,
  });

  // 2️⃣ Transform file → text chunks
  const textChunks = await transformFileToChunks(file);

  // 3️⃣ Store TEXT chunks
  const chunkDocs = textChunks.map(chunk => ({
    userId,
    type: "chunk",
    parentId: fileChunk._id,
    content: chunk.content,
  }));

  await Chunk.insertMany(chunkDocs);

  return fileChunk;
};

/**
 * PATCH /files/:id/move
 */
export const moveFile = async ({ userId, fileId, targetFolderId }) => {
  const file = await getFileById(userId, fileId);

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
};