import { Router } from "express";
import { authenticate } from "../auth/auth.middleware.js";
import { sendMessage } from "./chat.controller.js";

const router = Router();

/**
 * All /chat routes require authentication
 */
router.use(authenticate);

/**
 * POST /api/v1/chat
 *
 * Body:
 * {
 *   message: string,
 *   folderId?: string,
 *   limit?: number
 * }
 */
router.post("/", sendMessage);

export default router;
