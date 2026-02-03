import { asyncHandler } from "../../utils/asyncHandler.js";
import * as fileService from "./file.service.js";
import { AppError } from "../../utils/error.js";

/**
 * GET /api/v1/files
 */
export const listFiles = asyncHandler(async (req, res) => {
  const files = await fileService.listFiles(req.user.id);

  res.json({
    success: true,
    data: files,
  });
});

/**
 * GET /api/v1/files/:id
 */
export const getFileById = asyncHandler(async (req, res) => {
  const file = await fileService.getFileById(
    req.user.id,
    req.params.id
  );

  res.json({
    success: true,
    data: file,
  });
});

/**
 * POST /api/v1/files/upload
 */
export const uploadFile = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError("No file uploaded", 400);
  }

  console.log("req.file:", req.file);
  console.log("req.body:", req.body);

  const file = await fileService.uploadFile({
    userId: req.user.id,
    file: req.file,
    parentId: req.body.parentId || null,
  });

  res.status(201).json({
    success: true,
    data: file,
  });
});

/**
 * PATCH /api/v1/files/:id/move
 */
export const moveFile = asyncHandler(async (req, res) => {
  const file = await fileService.moveFile({
    userId: req.user.id,
    fileId: req.params.id,
    targetFolderId: req.body.targetFolderId || null,
  });

  res.json({
    success: true,
    data: file,
  });
});

/**
 * DELETE /api/v1/files/:id
 */
export const deleteFile = asyncHandler(async (req, res) => {
  await fileService.deleteFile(req.user.id, req.params.id);

  res.json({
    success: true,
    message: "File deleted successfully",
  });
});
