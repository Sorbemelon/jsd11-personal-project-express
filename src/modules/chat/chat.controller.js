import { asyncHandler } from "../../utils/asyncHandler.js";
import * as chatService from "./chat.service.js";

/**
 * POST /api/v1/chat
 * Send a message to the assistant
 */
export const sendMessage = asyncHandler(async (req, res) => {
  const result = await chatService.sendMessage({
    userId: req.user.id,
    message: req.body.message,
  });

  res.json({
    success: true,
    data: result,
  });
});