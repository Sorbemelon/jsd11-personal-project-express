import { Router } from "express";
import { router as v1Routes } from "./v1/routes.js";

export const router = Router();

router.use("/v1", v1Routes);
