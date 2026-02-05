import {
  register as registerService,
  login as loginService,
  refreshSession,
  logout as logoutService,
  sanitizeUser,
} from "./auth.service.js";

import { signAccessToken } from "../../utils/jwt.js";
import { AppError } from "../../utils/error.js";

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
    const { user } = await registerService(req.body);

    const accessToken = signAccessToken(user);

    res
      .cookie("accessToken", accessToken, {
        ...cookieOptions,
        maxAge: 15 * 60 * 1000,
      })
      .status(201)
      .json({
        accessToken,
        user: sanitizeUser(user),
      });
  } catch (err) {
    next(err);
  }
};

/* ======================================================
   LOGIN
====================================================== */
export const login = async (req, res, next) => {
  try {
    const { user, refresh } = await loginService(req.body);

    const accessToken = signAccessToken(user);

    res
      .cookie("accessToken", accessToken, {
        ...cookieOptions,
        maxAge: 15 * 60 * 1000,
      })
      .cookie("refreshToken", refresh.token, {
        ...cookieOptions,
        maxAge: refresh.expiresIn,
      })
      .json({
        accessToken,
        user: sanitizeUser(user),
      });
  } catch (err) {
    next(err);
  }
};

/* ======================================================
   REFRESH TOKEN
====================================================== */
export const refreshToken = async (req, res, next) => {
  try {
    const { user, newRefresh } = await refreshSession({
      token: req.cookies?.refreshToken,
    });

    const newAccessToken = signAccessToken(user);

    res
      .cookie("accessToken", newAccessToken, {
        ...cookieOptions,
        maxAge: 15 * 60 * 1000,
      })
      .cookie("refreshToken", newRefresh.token, {
        ...cookieOptions,
        maxAge: newRefresh.expiresIn,
      })
      .json({ accessToken: newAccessToken });
  } catch (err) {
    next(err);
  }
};

/* ======================================================
   LOGOUT
====================================================== */
export const logout = async (req, res, next) => {
  try {
    if (req.user?.id) await logoutService(req.user.id);

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
   ME
====================================================== */
export const me = async (req, res) => {
  res.status(200).json({ user: req.user ?? null });
};
