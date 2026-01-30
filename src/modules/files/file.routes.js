import { Router } from "express";
import { upload } from "../../config/multer.js";
import { authenticate } from "../auth/auth.middleware.js";
import {
  listFiles,
  getFileById,
  uploadFile,
  moveFile,
  deleteFile,
} from "./file.controller.js";

const router = Router();

/**
 * All /files routes require authentication
 */
router.use(authenticate);

/**
 * GET /api/v1/files
 */
router.get("/", listFiles);

/**
 * GET /api/v1/files/:id
 */
router.get("/:id", getFileById);

/**
 * POST /api/v1/files/upload
 * multipart/form-data
 * field name: "file"
 * optional body: parentId
 */
router.post(
  "/upload",
  upload.single("file"),
  uploadFile
);

/**
 * PATCH /api/v1/files/:id/move
 * body: { targetFolderId }
 */
router.patch("/:id/move", moveFile);

/**
 * DELETE /api/v1/files/:id
 */
router.delete("/:id", deleteFile);

export default router;