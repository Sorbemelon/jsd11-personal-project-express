import { asyncHandler } from "../../utils/asyncHandler.js";
import * as chatService from "./chat.service.js";

/**
 * POST /api/v1/chat
 * Send a message to the assistant
 *
 * Body:
 * {
 *   message: string,
 *   folderId?: string,
 *   limit?: number
 * }
 */
export const sendMessage = asyncHandler(async (req, res) => {
  const { message, folderId, limit } = req.body;

  const result = await chatService.sendMessage({
    userId: req.user.id,
    message,
    folderId: folderId || null,
    limit: limit || undefined,
  });

  res.json({
    success: true,
    data: result,
  });
});
