import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    password: {
      type: String,
      required: true,
      select: false,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    /**
     * 🔐 Stores ONLY the latest refresh token (string)
     * - Used for rotation & reuse detection
     * - Never sent to client
     */
    refreshToken: {
      type: String,
      default: null,
      select: false,
    },

    /**
     * - Increment to invalidate ALL refresh tokens
     * - Useful for "logout all devices"
     */
    tokenVersion: {
      type: Number,
      default: 0,
    },

    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Efficient auth lookups
userSchema.index({ email: 1, isActive: 1 });

export default mongoose.model("User", userSchema);
