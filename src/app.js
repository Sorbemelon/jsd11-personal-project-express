import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";

import { router as apiRoutes } from "./routes/index.js";
import { limiter } from "./middlewares/rateLimiter.js";
import { errorHandler } from "./utils/error.js";
import { AppError } from "./utils/error.js";

export const app = express();

app.set("trust proxy", 1);

// Security
app.use(helmet());

// CORS (cookie-based auth)
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:5175",
    ],
    credentials: true,
  })
);

// Rate limiting
app.use(limiter);

// Body + cookies
app.use(express.json());
app.use(cookieParser());

// Health check
app.get("/", (req, res) => {
  res.send("");
});

// API
app.use("/api", apiRoutes);

// 404 handler
app.use((req, res, next) => {
  next(new AppError(`Not found: ${req.method} ${req.originalUrl}`, 404));
});

// ✅ SINGLE centralized error handler
app.use(errorHandler);