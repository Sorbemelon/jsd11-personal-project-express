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

/* =====================================================
   HELPER: attach user safely (no throw)
===================================================== */
const attachUserFromAccessToken = async (req) => {
  const accessToken = req.cookies?.accessToken;
  if (!accessToken) return null;

  try {
    const payload = verifyAccessToken(accessToken);

    const user = await User.findById(payload.sub).select(
      "-password -refreshToken"
    );

    if (!user) return null;

    return {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
    };
  } catch {
    return null;
  }
};

/* =====================================================
   STRICT AUTH (for protected routes)
===================================================== */
export const authenticate = asyncHandler(async (req, res, next) => {
  /* 1) TRY ACCESS TOKEN */
  const accessUser = await attachUserFromAccessToken(req);
  if (accessUser) {
    req.user = accessUser;
    return next();
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
  if (!user || !user.refreshToken || user.refreshToken !== refreshToken) {
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

  /* 5) ATTACH USER */
  req.user = {
    id: user._id.toString(),
    email: user.email,
    name: user.name,
  };

  next();
});

/* =====================================================
   OPTIONAL AUTH (for /auth/me)
   → NEVER throws 401
   → NEVER refreshes tokens
===================================================== */
export const optionalAuth = asyncHandler(async (req, _res, next) => {
  const accessUser = await attachUserFromAccessToken(req);

  // attach user or null, but DO NOT throw
  req.user = accessUser ?? null;

  next();
});
