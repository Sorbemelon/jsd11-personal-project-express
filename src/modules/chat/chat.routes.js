import { Router } from "express";
import { authenticate } from "../auth/auth.middleware.js";
import { sendMessage } from "./chat.controller.js";

const router = Router();

/* All /chat routes require authentication */
router.use(authenticate);

router.post("/", sendMessage);

export default router;
