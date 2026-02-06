import { asyncHandler } from "../../utils/asyncHandler.js";
import {
  verifyAccessToken,
  verifyRefreshToken,
  signAccessToken,
  signRefreshToken,
} from "../../utils/jwt.js";
import { AppError } from "../../utils/error.js";
import User from "../../models/User.model.js";

const isProd = process.env.NODE_ENV === "production";

const cookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? "none" : "lax",
};

export const authenticate = asyncHandler(async (req, res, next) => {
  const accessToken = req.cookies?.accessToken;

  /* 1) TRY ACCESS TOKEN */
  if (accessToken) {
    try {
      const payload = verifyAccessToken(accessToken);

      const user = await User.findById(payload.sub).select(
        "-password -refreshToken"
      );

      if (!user) throw new AppError("User not found", 401);

      req.user = {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
      };

      return next();
    } catch {
      // access token expired → continue to refresh flow
    }
  }

  /* 2) TRY REFRESH TOKEN */
  const refreshToken = req.cookies?.refreshToken;

  if (!refreshToken) {
    throw new AppError("Unauthorized", 401);
  }

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError("Invalid refresh token", 401);
  }

  const user = await User.findById(payload.sub).select("+refreshToken");

  // CRITICAL NULL CHECK (prevents crash)
  if (!user) {
    throw new AppError("Invalid refresh token", 401);
  }

  // TOKEN MISMATCH CHECK
  if (!user.refreshToken || user.refreshToken !== refreshToken) {
    throw new AppError("Invalid refresh token", 401);
  }

  /* 3) ROTATE TOKENS */
  const newAccessToken = signAccessToken(user);
  const newRefresh = signRefreshToken(user, payload.remember);

  user.refreshToken = newRefresh.token;
  await user.save();

  /* 4) SET NEW COOKIES */
  res
    .cookie("accessToken", newAccessToken, {
      ...cookieOptions,
      maxAge: 15 * 60 * 1000, // 15 min
    })
    .cookie("refreshToken", newRefresh.token, {
      ...cookieOptions,
      maxAge: newRefresh.expiresIn,
    });

  /* 5) ATTACH USER TO REQUEST */
  req.user = {
    id: user._id.toString(),
    email: user.email,
    name: user.name,
  };

  next();
});
