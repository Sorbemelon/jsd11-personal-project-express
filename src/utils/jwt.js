import jwt from "jsonwebtoken";

export const signAccessToken = (user) =>
  jwt.sign(
    { sub: user._id },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: "1h" }
  );

export const signRefreshToken = (user) =>
  jwt.sign(
    { sub: user._id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: "7d" }
  );

export const verifyAccessToken = (token) =>
  jwt.verify(token, process.env.JWT_ACCESS_SECRET);

export const verifyRefreshToken = (token) =>
  jwt.verify(token, process.env.JWT_REFRESH_SECRET);