import { asyncHandler } from "../../utils/asyncHandler.js";
import * as folderService from "./folder.service.js";

/**
 * POST /api/v1/folders
 */
export const createFolder = asyncHandler(async (req, res) => {
  const folder = await folderService.createFolder({
    userId: req.user.id,
    name: req.body.name,
    parentId: req.body.parentId,
  });

  res.status(201).json({
    success: true,
    data: folder,
  });
});

/**
 * GET /api/v1/folders
 * GET /api/v1/folders?parentId=xxx
 */
export const listFolderContents = asyncHandler(async (req, res) => {
  const contents = await folderService.listFolderContents({
    userId: req.user.id,
    parentId: req.query.parentId || null,
  });

  res.json({
    success: true,
    data: contents,
  });
});

/**
 * GET /api/v1/folders/:id
 */
export const getFolderById = asyncHandler(async (req, res) => {
  const folder = await folderService.getFolderById({
    userId: req.user.id,
    folderId: req.params.id,
  });

  res.json({
    success: true,
    data: folder,
  });
});

/**
 * PATCH /api/v1/folders/:id/move
 */
export const moveFolder = asyncHandler(async (req, res) => {
  const folder = await folderService.moveFolder({
    userId: req.user.id,
    folderId: req.params.id,
    targetParentId: req.body.targetParentId,
  });

  res.json({
    success: true,
    data: folder,
  });
});

/**
 * DELETE /api/v1/folders/:id
 */
export const deleteFolder = asyncHandler(async (req, res) => {
  await folderService.deleteFolder({
    userId: req.user.id,
    folderId: req.params.id,
  });

  res.json({
    success: true,
    message: "Folder deleted successfully",
  });
});