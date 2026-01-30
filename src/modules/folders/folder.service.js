import Chunk from "../../models/Chunk.model.js";
import { AppError } from "../../utils/error.js";
import { deleteFromS3 } from "../../utils/s3.js";

/* ======================================================
   CREATE
====================================================== */
export const createFolder = async ({ userId, name, parentId = null }) => {
  if (!name) throw new AppError("Folder name is required", 400);

  if (parentId) {
    const parent = await Chunk.findOne({
      _id: parentId,
      userId,
      type: "folder",
      isDeleted: false,
    });
    if (!parent) throw new AppError("Parent folder not found", 404);
  }

  return Chunk.create({
    userId,
    type: "folder",
    name,
    parentId,
    isDeleted: false,
  });
};

/* ======================================================
   READ
====================================================== */
export const getFolderById = async ({ userId, folderId }) => {
  const folder = await Chunk.findOne({
    _id: folderId,
    userId,
    type: "folder",
    isDeleted: false,
  });

  if (!folder) throw new AppError("Folder not found", 404);
  return folder;
};

export const listFolderContents = async ({ userId, parentId = null }) => {
  const items = await Chunk.find({
    userId,
    parentId,
    type: { $in: ["folder", "file"] },
    isDeleted: false,
  }).sort({ type: 1, name: 1 });

  return Promise.all(
    items.map(async (item) => {
      if (item.type === "folder") {
        const stats = await countFolderStats(userId, item._id);
        return { ...item.toObject(), ...stats };
      }
      return item;
    })
  );
};

/* ======================================================
   MOVE
====================================================== */
export const moveFolder = async ({ userId, folderId, targetParentId }) => {
  const folder = await getFolderById({ userId, folderId });

  if (targetParentId) {
    const target = await Chunk.findOne({
      _id: targetParentId,
      userId,
      type: "folder",
      isDeleted: false,
    });
    if (!target) throw new AppError("Target folder not found", 404);

    if (String(target._id) === String(folder._id)) {
      throw new AppError("Cannot move folder into itself", 400);
    }

    await ensureNotDescendant(folder._id, target._id);
  }

  folder.parentId = targetParentId || null;
  await folder.save();
  return folder;
};

/* ======================================================
   DELETE (Soft + Async S3)
====================================================== */
export const deleteFolder = async ({ userId, folderId }) => {
  const folder = await getFolderById({ userId, folderId });

  await softDeleteRecursively(userId, folder._id);
  folder.isDeleted = true;
  await folder.save();

  // non-blocking S3 cleanup
  setImmediate(() => cleanupS3(userId, folder._id));

  return { success: true };
};

/* ======================================================
   TREE
====================================================== */
export const getFolderTree = async ({ userId, folderId = null }) => {
  const root = folderId
    ? await getFolderById({ userId, folderId })
    : { _id: null, name: "root", type: "folder" };

  const children = await buildTree(userId, root._id);

  return folderId
    ? { ...root.toObject(), children }
    : { ...root, children };
};

/* ======================================================
   HELPERS
====================================================== */

const softDeleteRecursively = async (userId, parentId) => {
  const nodes = await Chunk.find({
    userId,
    parentId,
    isDeleted: false,
  });

  for (const node of nodes) {
    if (node.type === "folder") {
      await softDeleteRecursively(userId, node._id);
    }
    node.isDeleted = true;
    await node.save();
  }
};

const ensureNotDescendant = async (sourceId, targetId) => {
  let current = await Chunk.findById(targetId);

  while (current?.parentId) {
    if (String(current.parentId) === String(sourceId)) {
      throw new AppError(
        "Cannot move folder into its own descendant",
        400
      );
    }
    current = await Chunk.findById(current.parentId);
  }
};

const buildTree = async (userId, parentId) => {
  const nodes = await Chunk.find({
    userId,
    parentId,
    type: { $in: ["folder", "file"] },
    isDeleted: false,
  }).sort({ type: 1, name: 1 });

  return Promise.all(
    nodes.map(async (node) =>
      node.type === "folder"
        ? { ...node.toObject(), children: await buildTree(userId, node._id) }
        : node
    )
  );
};

/* ======================================================
   COUNTS
====================================================== */
const countFolderStats = async (userId, folderId) => {
  const [files, folders] = await Promise.all([
    Chunk.countDocuments({
      userId,
      parentId: folderId,
      type: "file",
      isDeleted: false,
    }),
    Chunk.countDocuments({
      userId,
      parentId: folderId,
      type: "folder",
      isDeleted: false,
    }),
  ]);

  return { fileCount: files, folderCount: folders };
};

/* ======================================================
   S3 CLEANUP (DELETED ONLY)
====================================================== */
const cleanupS3 = async (userId, parentId) => {
  const nodes = await Chunk.find({ userId, parentId });

  for (const node of nodes) {
    if (node.type === "file" && node.storage?.key) {
      try {
        await deleteFromS3(node.storage.key);
      } catch (err) {
        console.error("S3 delete failed:", node.storage.key, err.message);
      }
    }

    if (node.type === "folder") {
      await cleanupS3(userId, node._id);
    }
  }
};
