import mongoose from "mongoose";

const itemSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // folder | file
    type: {
      type: String,
      enum: ["folder", "file"],
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
      ref: "Item",
      default: null,
      index: true,
    },

    /* ---------- FILE METADATA ---------- */
    mimeType: {
      type: String,
      required: function () {
        return this.type === "file";
      },
    },

    size: {
      type: Number,
      required: function () {
        return this.type === "file";
      },
    },

    // S3 Storage information
    storage: {
      provider: {
        type: String,
        enum: ["s3"],
        default: "s3",
      },

      uri: {
        type: String, // S3 full URI
        required: function () {
          return this.type === "file";
        },
      },

      key: {
        type: String, // S3 object key
        required: function () {
          return this.type === "file";
        },
      },
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
itemSchema.index({ userId: 1, parentId: 1 });
itemSchema.index({ userId: 1, type: 1 });

export default mongoose.model("Item", itemSchema);
