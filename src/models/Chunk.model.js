// src/models/Chunk.model.js
import mongoose from "mongoose";

const chunkSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

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

    // File metadata
    mimeType: {
      type: String,
    },

    size: {
      type: Number, // bytes
    },

    // Raw text (for chunk / RAG)
    content: {
      type: String,
    },

    // Vector embedding (future)
    embedding: {
      status: {
        type: String,
        enum: ["PENDING", "PROCESSING", "READY", "FAILED"],
        default: "PENDING",
      },
      dims: { type: Number, default: 3072 },
      vector: { type: [Number], select: false },
      attempts: { type: Number, default: 0 },
      lastAttemptAt: { type: Date, default: null },
      updatedAt: { type: Date, default: null },
      lastError: { type: String, default: null },
    },

    // Storage
    storagePath: {
      type: String,
    },

    // Ordering in folder
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

// Indexes for folder tree + search
chunkSchema.index({ userId: 1, parentId: 1 });
chunkSchema.index({ userId: 1, type: 1 });
chunkSchema.index({ name: "text", content: "text" });

const Chunk = mongoose.model("Chunk", chunkSchema);
export default Chunk;