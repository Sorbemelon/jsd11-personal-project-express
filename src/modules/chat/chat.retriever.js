// src/modules/chat/chat.retriever.js
import Chunk from "../../models/Chunk.model.js";
import { embedText } from "../embeddings/embedding.service.js";

/**
 * Retrieve relevant chunks using vector search
 */
export const retrieveRelevantChunks = async ({
  userId,
  query,
  folderId = null,
  limit = 5,
}) => {
  const queryVector = await embedText({ text: query });

  const numCandidates = Math.max(50, limit * 10);

  const filter = {
    userId,
    type: "chunk",
    isDeleted: false,
    "embedding.status": "READY",
  };

  // Optional folder scope
  if (folderId) {
    filter.parentId = folderId;
  }

  return Chunk.aggregate([
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
        parentId: 1,
        content: 1,
        metadata: 1,
        score: { $meta: "vectorSearchScore" },
      },
    },
  ]);
};
