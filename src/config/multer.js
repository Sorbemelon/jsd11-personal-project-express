import multer from "multer";
import { AppError } from "../utils/error.js";

const storage = multer.memoryStorage();

/**
 * Allowed MIME types
 */
const allowedTypes = [
  // pdf
  "application/pdf",

  // text
  "text/plain",
  "text/csv",
  "text/tab-separated-values",
  "text/markdown",
  "text/html",
  "application/json",

  // word
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

  // excel
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",

  // powerpoint
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-powerpoint",

  // images (for OCR)
  "image/png",
  "image/jpeg",
  "image/jpg",
];

/**
 * Fix latin1 → utf8 filename encoding (important for Thai filenames)
 */
const fixFilenameEncoding = (file) => {
  if (!file?.originalname) return;

  try {
    file.originalname = Buffer.from(file.originalname, "latin1").toString("utf8");
  } catch {
    // keep original if conversion fails
  }
};

const multerUpload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new AppError(`Unsupported file type: ${file.mimetype}`, 400));
    }

    cb(null, true);
  },
});

export const upload = (req, res, next) => {
  multerUpload.single("file")(req, res, (err) => {
    if (!err && req.file) {
      fixFilenameEncoding(req.file);
      return next();
    }

    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return next(new AppError("File size exceeds 10MB limit", 400));
      }

      return next(new AppError(err.message, 400));
    }

    if (err?.isOperational) return next(err);

    return next(new AppError("File upload failed", 500));
  });
};
