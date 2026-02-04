// src/modules/chat/chat.retriever.js
import mongoose from "mongoose";
import Chunk from "../../models/Chunk.model.js";
import { embedText } from "../embeddings/embedding.service.js";

/**
 * Retrieve relevant chunks using MongoDB Atlas Vector Search
 */
export const retrieveRelevantChunks = async ({
  userId,
  query,
  folderId = null,
  fileIds,
  limit = 5,
}) => {
  /* ======================================================
     STEP 1: Embed query
  ====================================================== */

  const embeddingResult = await embedText(query);

  if (
    embeddingResult.status !== "READY" ||
    !Array.isArray(embeddingResult.vector)
  ) {
    return [];
  }

  const queryVector = embeddingResult.vector;
  const numCandidates = Math.max(50, limit * 10);

  /* ======================================================
     STEP 2: SECURITY — require explicit fileIds
     - undefined  → block
     - []         → block
  ====================================================== */

  if (!Array.isArray(fileIds) || fileIds.length === 0) {
    console.warn("RAG blocked: no fileIds provided");
    return [];
  }

  /* ======================================================
     STEP 3: Normalize ObjectIds
  ====================================================== */

  const normalizedFileIds = fileIds
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  // If none valid → block
  if (normalizedFileIds.length === 0) {
    console.warn("RAG blocked: invalid fileIds");
    return [];
  }

  /* ======================================================
     STEP 4: Build filter
  ====================================================== */

  const filter = {
    userId: new mongoose.Types.ObjectId(userId),
    isDeleted: false,
    "embedding.status": "READY",
    itemId: { $in: normalizedFileIds }, // ALWAYS restrict
  };

  /* ======================================================
     STEP 5: Vector search
  ====================================================== */

  const results = await Chunk.aggregate([
    {
      $vectorSearch: {
        index: "chunks_embedding_vector_index",
        path: "embedding.vector",
        queryVector,
        numCandidates,
        limit,
        filter,
      },
    },
    {
      $project: {
        _id: 1,
        itemId: 1,
        content: 1,
        score: { $meta: "vectorSearchScore" },
      },
    },
  ]);

  console.log("Vector results count:", results.length);
  return results;
};
