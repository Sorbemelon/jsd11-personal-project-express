import User from "../../models/User.model.js";
import { hashPassword, comparePassword } from "../../utils/hash.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../../utils/jwt.js";
import { AppError } from "../../utils/error.js";
import { createFolder } from "../folders/folder.service.js";

/* ======================================================
   REGISTER
====================================================== */
export const register = async ({ email, password, name }) => {
  const existing = await User.findOne({ email });
  if (existing) {
    throw new AppError("Email already registered", 409);
  }

  const hashed = await hashPassword(password);

  const user = await User.create({
    email,
    password: hashed,
    name,
  });

  try {
    await createFolder({
      userId: user._id,
      name,
      parentId: null,
      newUser: true,
    });
  } catch (err) {
    await User.findByIdAndDelete(user._id);
    throw new AppError("Account setup failed", 500);
  }

  // 🔐 tokens are created by controller
  return {
    user: sanitizeUser(user),
  };
};

/* ======================================================
   LOGIN
====================================================== */
export const login = async ({ email, password, remember = false }) => {
  const user = await User.findOne({ email }).select("+password");

  if (!user) {
    throw new AppError("Invalid email or password", 401);
  }

  const valid = await comparePassword(password, user.password);
  if (!valid) {
    throw new AppError("Invalid email or password", 401);
  }

  // refresh token rotation
  const refreshToken = signRefreshToken(user, remember);
  user.refreshToken = refreshToken;
  await user.save();

  return {
    user: sanitizeUser(user),
  };
};

/* ======================================================
   REFRESH TOKEN
====================================================== */
export const refreshToken = async ({ token }) => {
  if (!token) {
    throw new AppError("Refresh token required", 401);
  }

  const payload = verifyRefreshToken(token);

  const user = await User.findById(payload.sub);
  if (!user || user.refreshToken !== token) {
    throw new AppError("Invalid refresh token", 401);
  }

  // rotate refresh token
  const newRefreshToken = signRefreshToken(user, payload.remember);
  user.refreshToken = newRefreshToken;
  await user.save();

  return {
    userId: user._id,
    remember: payload.remember,
  };
};

/* ======================================================
   LOGOUT
====================================================== */
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

/* ======================================================
   HELPERS
====================================================== */
export const sanitizeUser = (user) => {
  const obj = user.toObject();
  delete obj.password;
  delete obj.refreshToken;
  return obj;
};
