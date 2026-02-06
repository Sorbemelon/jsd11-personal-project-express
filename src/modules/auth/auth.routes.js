import { Router } from "express";
import {
  login,
  register,
  refreshToken,
  logout,
  me,
} from "./auth.controller.js";
import { authenticate } from "./auth.middleware.js";

const router = Router();

/* Public auth routes */
router.post("/register", register);
router.post("/login", login);
router.post("/refresh", refreshToken);

/* Protected auth routes */
router.use(authenticate);

router.post("/logout", logout);
router.get("/me", me);

export default router;