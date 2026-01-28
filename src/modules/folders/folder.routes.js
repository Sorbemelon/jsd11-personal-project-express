import { Router } from "express";
import { authenticate } from "../auth/auth.middleware.js";
import {
  createFolder,
  listFolderContents,
  getFolderById,
  moveFolder,
  deleteFolder,
} from "./folder.controller.js";

const router = Router();

/**
 * All /folders routes require authentication
 */
router.use(authenticate);

/**
 * GET    /api/v1/folders
 * POST   /api/v1/folders
 */
router
  .route("/")
  .get(listFolderContents)
  .post(createFolder);

/**
 * GET    /api/v1/folders/:id
 * DELETE /api/v1/folders/:id
 */
router
  .route("/:id")
  .get(getFolderById)
  .delete(deleteFolder);

/**
 * PATCH  /api/v1/folders/:id/move
 */
router.patch("/:id/move", moveFolder);

export default router;