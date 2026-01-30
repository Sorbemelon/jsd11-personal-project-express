import mongoose from "mongoose";

const chunkSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // folder | file | chunk
    type: {
      type: String,
      enum: ["folder", "file", "chunk"],
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chunk",
      default: null,
      index: true,
    },

    /* ---------- FILE METADATA ---------- */
    mimeType: String,
    size: Number,

    /* ---------- TRANSFORMED CONTENT ---------- */
    content: {
      type: String, // normalized text (for RAG/search)
    },

    rawJson: {
      type: mongoose.Schema.Types.Mixed, // original transformed JSON
    },

    /* ---------- EMBEDDING STATUS ---------- */
    embedding: {
      status: {
        type: String,
        enum: ["PENDING", "PROCESSING", "READY", "FAILED"],
        default: "PENDING",
      },
      dims: { type: Number, default: 3072 },
      vector: { type: [Number], select: false },
      attempts: { type: Number, default: 0 },
      lastAttemptAt: Date,
      updatedAt: Date,
      lastError: String,
    },

    /* ---------- STORAGE ---------- */
    storage: {
      provider: {
        type: String,
        enum: ["s3"],
        default: "s3",
      },
      uri: {
        type: String, // S3 full URL
        required: true,
      },
      key: {
        type: String, // S3 object key
        required: true,
      },
    },

    order: {
      type: Number,
      default: 0,
    },

    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

/* ---------- INDEXES ---------- */
chunkSchema.index({ userId: 1, parentId: 1 });
chunkSchema.index({ userId: 1, type: 1 });
chunkSchema.index({ name: "text", content: "text" });

export default mongoose.model("Chunk", chunkSchema);