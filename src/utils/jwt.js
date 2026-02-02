import jwt from "jsonwebtoken";

/**
 * Access token
 * - Always short-lived
 */
export const signAccessToken = (user) =>
  jwt.sign(
    { sub: user._id },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: "15m" }
  );

/**
 * Refresh token
 * - Expiry depends on remember flag
 */
export const signRefreshToken = (user, remember = false) =>
  jwt.sign(
    {
      sub: user._id,
      remember,
    },
    process.env.JWT_REFRESH_SECRET,
    {
      expiresIn: remember ? "7d" : "1d",
    }
  );

export const verifyAccessToken = (token) =>
  jwt.verify(token, process.env.JWT_ACCESS_SECRET);

export const verifyRefreshToken = (token) =>
  jwt.verify(token, process.env.JWT_REFRESH_SECRET);
