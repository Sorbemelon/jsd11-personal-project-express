import User from "../../models/User.model.js";
import { hashPassword, comparePassword } from "../../utils/hash.js";
import {
  signRefreshToken,
  verifyRefreshToken,
} from "../../utils/jwt.js";
import { AppError } from "../../utils/error.js";
import { createFolder } from "../folders/folder.service.js";

/* REGISTER */
export const register = async ({ email, password, name }) => {
  const existing = await User.findOne({ email });
  if (existing) throw new AppError("Email already registered", 409);

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
  } catch {
    await User.findByIdAndDelete(user._id);
    throw new AppError("Account setup failed", 500);
  }

  return { user };
};

/* LOGIN */
export const login = async ({ email, password, remember = false }) => {
  const user = await User.findOne({ email }).select("+password +refreshToken");
  if (!user) throw new AppError("Invalid email or password", 401);

  const valid = await comparePassword(password, user.password);
  if (!valid) throw new AppError("Invalid email or password", 401);

  const refresh = signRefreshToken(user, remember);

  user.refreshToken = refresh.token;
  await user.save();

  return { user, refresh };
};

/* REFRESH TOKEN */
export const refreshSession = async ({ token }) => {
  if (!token) throw new AppError("Refresh token required", 401);

  const payload = verifyRefreshToken(token);

  const user = await User.findById(payload.sub).select("+refreshToken");
  if (!user || user.refreshToken !== token) {
    throw new AppError("Invalid refresh token", 401);
  }

  const newRefresh = signRefreshToken(user, payload.remember);

  user.refreshToken = newRefresh.token;
  await user.save();

  return { user, newRefresh };
};

/* LOGOUT */
export const logout = async (userId) => {
  await User.findByIdAndUpdate(userId, { refreshToken: null });
};

/* HELPER */
export const sanitizeUser = (user) => {
  const obj = user.toObject();
  delete obj.password;
  delete obj.refreshToken;
  return obj;
};
