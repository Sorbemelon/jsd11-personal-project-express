import mongoose from "mongoose";

const fileSchema = new mongoose.Schema(
  {
    name: String,
    mimeType: String,
    size: Number,
    path: String,

    folderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Folder",
      default: null,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("File", fileSchema);