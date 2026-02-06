import { asyncHandler } from "../../utils/asyncHandler.js";
import * as chatService from "./chat.service.js";

export const sendMessage = asyncHandler(async (req, res) => {
  const { message, folderId, fileIds, limit } = req.body;

  const result = await chatService.sendMessage({
    userId: req.user.id,
    message,
    folderId: folderId || null,
    fileIds: fileIds || null,
    limit: limit || undefined,
  });

  res.json({
    success: true,
    data: result,
  });
});
