// auth.controller.js
import User from "../../models/User.model.js";
import { hashPassword, comparePassword } from "../../utils/hash.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../../utils/jwt.js";
import { AppError } from "../../utils/error.js";
import { createFolder } from "../folders/folder.service.js";

const isProd = process.env.NODE_ENV === "production";

const cookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? "none" : "lax",
};

/* ======================================================
   REGISTER
====================================================== */
export const register = async (req, res, next) => {
  try {
    const { email, password, name } = req.body;

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
    } catch {
      await User.findByIdAndDelete(user._id);
      throw new AppError("Account setup failed. Please try again.", 500);
    }

    const accessToken = signAccessToken(user);
    const refresh = signRefreshToken(user, false);

    user.refreshToken = refresh.token;
    await user.save();

    res
      .cookie("accessToken", accessToken, {
        ...cookieOptions,
        maxAge: 15 * 60 * 1000,
      })
      .cookie("refreshToken", refresh.token, {
        ...cookieOptions,
        maxAge: refresh.expiresIn,
      })
      .status(201)
      .json({ user: sanitizeUser(user) });
  } catch (err) {
    next(err);
  }
};

/* ======================================================
   LOGIN
====================================================== */
export const login = async (req, res, next) => {
  try {
    const { email, password, remember = false } = req.body;

    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      throw new AppError("Invalid email or password", 401);
    }

    const valid = await comparePassword(password, user.password);
    if (!valid) {
      throw new AppError("Invalid email or password", 401);
    }

    const accessToken = signAccessToken(user);
    const refresh = signRefreshToken(user, remember);

    user.refreshToken = refresh.token;
    await user.save();

    res
      .cookie("accessToken", accessToken, {
        ...cookieOptions,
        maxAge: 15 * 60 * 1000,
      })
      .cookie("refreshToken", refresh.token, {
        ...cookieOptions,
        maxAge: refresh.expiresIn,
      })
      .json({ user: sanitizeUser(user) });
  } catch (err) {
    next(err);
  }
};

/* ======================================================
   REFRESH TOKEN
====================================================== */
export const refreshToken = async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) {
      throw new AppError("Refresh token required", 401);
    }

    const payload = verifyRefreshToken(token);

    const user = await User.findById(payload.sub).select("+refreshToken");
    if (!user || user.refreshToken !== token) {
      throw new AppError("Invalid refresh token", 401);
    }

    const newAccessToken = signAccessToken(user);
    const refresh = signRefreshToken(user, payload.remember);

    user.refreshToken = refresh.token;
    await user.save();

    res
      .cookie("accessToken", newAccessToken, {
        ...cookieOptions,
        maxAge: 15 * 60 * 1000,
      })
      .cookie("refreshToken", refresh.token, {
        ...cookieOptions,
        maxAge: refresh.expiresIn,
      })
      .json({ ok: true });
  } catch (err) {
    next(err);
  }
};

/* ======================================================
   LOGOUT
====================================================== */
export const logout = async (req, res, next) => {
  try {
    if (req.user?.id) {
      await User.findByIdAndUpdate(req.user.id, {
        refreshToken: null,
      });
    }

    res
      .clearCookie("accessToken", cookieOptions)
      .clearCookie("refreshToken", cookieOptions)
      .status(204)
      .send();
  } catch (err) {
    next(err);
  }
};

/* ======================================================
   ME  ✅ SAFE ENDPOINT
====================================================== */
export const me = async (req, res) => {
  if (!req.user) {
    return res.status(200).json({ user: null });
  }

  res.status(200).json({ user: req.user });
};

/* ======================================================
   HELPERS
====================================================== */
const sanitizeUser = (user) => {
  const obj = user.toObject();
  delete obj.password;
  delete obj.refreshToken;
  return obj;
};
