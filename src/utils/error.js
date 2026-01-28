// src/utils/error.js
import { logger } from "./logger.js";

export class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;

  // Log full error (server-side only)
  logger.error(err);

  res.status(statusCode).json({
    success: false,
    message: err.isOperational
      ? err.message
      : "Internal server error",
  });
};