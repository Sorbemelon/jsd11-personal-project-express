import User from "../../models/User.model.js";
import { hashPassword, comparePassword } from "../../utils/hash.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../../utils/jwt.js";
import { AppError } from "../../utils/error.js";
import { createFolder } from "../folders/folder.service.js";

export const register = async ({ email, password, name }) => {
  const existing = await User.findOne({ email });
  if (existing) {
    throw new AppError("Email already registered", 409);
  }

  const hashed = await hashPassword(password);

  // 1️⃣ Create user
  const user = await User.create({
    email,
    password: hashed,
    name,
  });

  try {
    // 2️⃣ Create root folder named after user
    await createFolder({
      userId: user._id,
      name: name,
      parentId: null,
      newUser: true
    });
  } catch (err) {
    // 🔴 Rollback user if folder creation fails
    await User.findByIdAndDelete(user._id);

    console.error("Root folder creation failed:", err);
    throw new AppError(
      "Account setup failed. Please try again.",
      500
    );
  }

  // 3️⃣ Tokens
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);

  user.refreshToken = refreshToken;
  await user.save();

  return {
    user: sanitizeUser(user),
    accessToken,
    refreshToken,
  };
};

export const login = async ({ email, password, remember = false }) => {
  const user = await User.findOne({ email }).select("+password");

  if (!user) {
    throw new AppError("Invalid email or password", 401);
  }

  const valid = await comparePassword(password, user.password);
  if (!valid) {
    throw new AppError("Invalid email or password", 401);
  }

  const accessToken = signAccessToken(user);

  // 🔐 remember-aware refresh token
  const refreshToken = signRefreshToken(user, remember);

  user.refreshToken = refreshToken;
  await user.save();

  return {
    user: sanitizeUser(user),
    accessToken,
    refreshToken,
  };
};

export const refreshToken = async ({ refreshToken }) => {
  if (!refreshToken) {
    throw new AppError("Refresh token required", 401);
  }

  const payload = verifyRefreshToken(refreshToken);

  const user = await User.findById(payload.sub);
  if (!user || user.refreshToken !== refreshToken) {
    throw new AppError("Invalid refresh token", 401);
  }

  const newAccessToken = signAccessToken(user);
  const newRefreshToken = signRefreshToken(user);

  user.refreshToken = newRefreshToken;
  await user.save();

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
};

export const logout = async (userId) => {
  const user = await User.findByIdAndUpdate(
    userId,
    { refreshToken: null },
    { new: true }
  );

  if (!user) {
    throw new AppError("User not found", 404);
  }
};

/* ---------------- helpers ---------------- */

export const sanitizeUser = (user) => {
  const obj = user.toObject();
  delete obj.password;
  delete obj.refreshToken;
  return obj;
};