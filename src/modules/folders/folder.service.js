import Chunk from "../../models/Chunk.model.js";
import { AppError } from "../../utils/error.js";

/**
 * Create a new folder
 */
export const createFolder = async ({ userId, name, parentId = null }) => {
  if (!name) {
    throw new AppError("Folder name is required", 400);
  }

  // Optional: validate parent folder
  if (parentId) {
    const parent = await Chunk.findOne({
      _id: parentId,
      userId,
      type: "folder",
    });

    if (!parent) {
      throw new AppError("Parent folder not found", 404);
    }
  }

  return Chunk.create({
    userId,
    type: "folder",
    name,
    parentId,
  });
};

/**
 * List folders & files under a folder (or root)
 */
export const listFolderContents = async ({ userId, parentId = null }) => {
  return Chunk.find({
    userId,
    parentId,
    type: { $in: ["folder", "file"] },
  }).sort({ type: 1, name: 1 });
};

/**
 * Get folder by id
 */
export const getFolderById = async ({ userId, folderId }) => {
  const folder = await Chunk.findOne({
    _id: folderId,
    userId,
    type: "folder",
  });

  if (!folder) {
    throw new AppError("Folder not found", 404);
  }

  return folder;
};

/**
 * Move folder (or file) to another folder
 */
export const moveFolder = async ({
  userId,
  folderId,
  targetParentId,
}) => {
  const folder = await Chunk.findOne({
    _id: folderId,
    userId,
    type: "folder",
  });

  if (!folder) {
    throw new AppError("Folder not found", 404);
  }

  if (targetParentId) {
    const target = await Chunk.findOne({
      _id: targetParentId,
      userId,
      type: "folder",
    });

    if (!target) {
      throw new AppError("Target folder not found", 404);
    }

    // Prevent circular nesting
    if (String(target._id) === String(folder._id)) {
      throw new AppError("Cannot move folder into itself", 400);
    }
  }

  folder.parentId = targetParentId || null;
  await folder.save();

  return folder;
};

/**
 * Delete folder recursively
 */
export const deleteFolder = async ({ userId, folderId }) => {
  const folder = await Chunk.findOne({
    _id: folderId,
    userId,
    type: "folder",
  });

  if (!folder) {
    throw new AppError("Folder not found", 404);
  }

  // Recursive delete
  await deleteChildren(userId, folderId);

  await folder.deleteOne();

  return { success: true };
};

/* ---------------- helpers ---------------- */

const deleteChildren = async (userId, parentId) => {
  const children = await Chunk.find({ userId, parentId });

  for (const child of children) {
    if (child.type === "folder") {
      await deleteChildren(userId, child._id);
    }
    await child.deleteOne();
  }
};