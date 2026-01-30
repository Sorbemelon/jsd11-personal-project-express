import multer from "multer";

/**
 * Memory storage is required for:
 *  - Uploading to S3
 *  - Transforming files (PDF, DOCX, CSV, etc.)
 */
const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "application/pdf",
      "text/plain",
      "text/csv",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      return cb(
        new Error(`Unsupported file type: ${file.mimetype}`),
        false
      );
    }

    cb(null, true);
  },
});