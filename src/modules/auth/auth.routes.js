import { Router } from "express";
import {
  login,
  register,
  refreshToken,
  logout,
  me,
} from "./auth.controller.js";
import { authenticate, optionalAuth } from "./auth.middleware.js";

const router = Router();

/* PUBLIC AUTH ROUTES */
router.post("/register", register);
router.post("/login", login);
router.post("/refresh", refreshToken);

/* /me must NOT use strict authenticate
   otherwise it throws 401 when not logged in */
router.get("/me", optionalAuth, me);

/* PROTECTED AUTH ROUTES */
router.post("/logout", authenticate, logout);

export default router;
