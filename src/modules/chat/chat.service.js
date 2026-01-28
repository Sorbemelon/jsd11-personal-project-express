import Chunk from "../../models/Chunk.model.js";
import { AppError } from "../../utils/error.js";

/**
 * Send a chat message
 * (RAG-ready, embeddings come later)
 */
export const sendMessage = async ({ userId, message }) => {
  if (!message || !message.trim()) {
    throw new AppError("Message is required", 400);
  }

  /**
   * STEP 1: Retrieve relevant chunks (TEMP: naive strategy)
   * Later:
   *  - vector search
   *  - similarity scoring
   *  - top-k retrieval
   */
  const contextChunks = await Chunk.find({
    userId,
    type: "chunk",
    isDeleted: false,
  })
    .sort({ createdAt: -1 })
    .limit(5);

  const contextText = contextChunks
    .map((c) => c.content)
    .join("\n\n");

  /**
   * STEP 2: Build prompt
   * (LLM call will replace this later)
   */
  const prompt = `
You are a helpful assistant.
Use the context below to answer the user's question.

Context:
${contextText || "No context available."}

User question:
${message}
`.trim();

  /**
   * STEP 3: Generate response
   * (Placeholder for now)
   */
  const answer = await generateMockResponse(prompt);

  /**
   * STEP 4: Return structured response
   */
  return {
    question: message,
    answer,
    sources: contextChunks.map((c) => ({
      id: c._id,
      fileId: c.parentId,
      metadata: c.metadata || {},
    })),
  };
};

/* ---------------- helpers ---------------- */

/**
 * Temporary mock LLM response
 * Replace with OpenAI / Gemini / Claude later
 */
const generateMockResponse = async (prompt) => {
  return `
🤖 This is a placeholder response.

Your question was processed successfully.
Once embeddings and LLM integration are enabled,
this answer will be generated using your uploaded documents.

Prompt preview:
"${prompt.slice(0, 200)}..."
`.trim();
};