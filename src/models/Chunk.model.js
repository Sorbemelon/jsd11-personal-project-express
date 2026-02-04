import mongoose from "mongoose";

const chunkSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Item",
      default: null,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    /* ---------- TRANSFORMED CONTENT ---------- */
    content: {
      type: String, // normalized text (for RAG/search)
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
chunkSchema.index({ userId: 1, itemId: 1 });
chunkSchema.index({ name: "text", content: "text" });

export default mongoose.model("Chunk", chunkSchema);
