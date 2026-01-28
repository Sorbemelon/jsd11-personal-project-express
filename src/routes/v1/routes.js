import { Router } from "express";

// Module routes
import authRoutes from "../../modules/auth/auth.routes.js";
import fileRoutes from "../../modules/files/file.routes.js";
import folderRoutes from "../../modules/folders/folder.routes.js";
import chatRoutes from "../../modules/chat/chat.routes.js";

// Middlewares
import { authenticate } from "../../modules/auth/auth.middleware.js";

export const router = Router();

/**
 * Health check
 */
router.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    version: "v1",
    timestamp: new Date().toISOString(),
  });
});

/**
 * Public routes
 */
router.use("/auth", authRoutes);

/**
 * Protected routes
 * All routes below require authentication
 */
router.use(authenticate);

router.use("/files", fileRoutes);
router.use("/folders", folderRoutes);
router.use("/chat", chatRoutes);

export default router;