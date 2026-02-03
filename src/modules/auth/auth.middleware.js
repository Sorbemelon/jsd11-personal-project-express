// auth.middleware.js
import { asyncHandler } from "../../utils/asyncHandler.js";
import { verifyAccessToken } from "../../utils/jwt.js";
import { AppError } from "../../utils/error.js";
import User from "../../models/User.model.js";

export const authenticate = asyncHandler(async (req, res, next) => {
  /**
   * 🔐 Cookie-only authentication
   * - accessToken is HttpOnly cookie
   * - do NOT read Authorization header
   */
  const token = req.cookies?.accessToken;

  if (!token) {
    throw new AppError("Unauthorized", 401);
  }

  const payload = verifyAccessToken(token);

  const user = await User.findById(payload.sub).select("-password");
  if (!user) {
    throw new AppError("User not found", 401);
  }

  req.user = {
    id: user._id,
    email: user.email,
    name: user.name,
  };

  next();
});
