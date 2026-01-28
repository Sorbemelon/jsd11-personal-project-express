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
      select: false, // ⛔ never returned unless explicitly asked
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    refreshToken: {
      type: String,
      default: null,
      select: false,
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

// Optional: compound indexes (future-proofing)
userSchema.index({ email: 1, isActive: 1 });

const User = mongoose.model("User", userSchema);
export default User;