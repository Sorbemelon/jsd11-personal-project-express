// src/config/multer.js
import multer from "multer";
import { AppError } from "../utils/error.js";

/**
 * Memory storage is required for:
 *  - Uploading to S3
 *  - Transforming files (PDF, DOCX, CSV, etc.)
 */
const storage = multer.memoryStorage();

const allowedTypes = [
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const multerUpload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(
        new AppError(
          `Unsupported file type: ${file.mimetype}`,
          400
        )
      );
    }

    cb(null, true);
  },
});

/**
 * Wrapper to normalize Multer errors into AppError
 */
export const upload = (req, res, next) => {
  multerUpload.single("file")(req, res, (err) => {
    if (!err) return next();

    // Multer-specific errors
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return next(
          new AppError("File size exceeds 10MB limit", 400)
        );
      }

      return next(new AppError(err.message, 400));
    }

    // AppError from fileFilter
    if (err.isOperational) {
      return next(err);
    }

    // Unknown error
    return next(new AppError("File upload failed", 500));
  });
};
