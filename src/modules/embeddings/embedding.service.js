// src/modules/embeddings/embedding.service.js
import axios from "axios";

const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com";
const EMBEDDING_MODEL = "models/text-embedding-001";
const GENERATION_MODEL = "gemini-2.5-flash";
const EXPECTED_EMBEDDING_DIMS = 3072;

const baseUrl = process.env.GEMINI_API_BASE_URL || DEFAULT_BASE_URL
const model = process.env.GEMINI_EMBEDDING_MODEL || GENERATION_MODEL


/* ---------------- helpers ---------------- */

const isRetryable = (err) => {
  const status = err?.response?.status;
  return !status || status === 429 || status >= 500;
};

const getApiKeys = () =>
  [
    process.env.GEMINI_API_KEY1,
    process.env.GEMINI_API_KEY2,
    process.env.GEMINI_API_KEY3,
    process.env.GEMINI_API_KEY4,
    process.env.GEMINI_API_KEY5,
  ].filter(Boolean);

/* ---------------- public API ---------------- */

/**
 * Embed a single text chunk
 * Returns object compatible with Chunk.embedding schema
 */
export const embedText = async (text, prevAttempts = 0) => {
  const now = new Date();
  const trimmed = String(text || "").trim();

  /* ---------- empty text ---------- */
  if (!trimmed) {
    return {
      status: "FAILED",
      dims: EXPECTED_EMBEDDING_DIMS,
      vector: null,
      attempts: prevAttempts + 1,
      lastAttemptAt: now,
      updatedAt: now,
      lastError: "EMPTY_TEXT",
    };
  }

  /* ---------- API keys ---------- */
  const apiKeys = getApiKeys();
  if (!apiKeys.length) {
    return {
      status: "FAILED",
      dims: EXPECTED_EMBEDDING_DIMS,
      vector: null,
      attempts: prevAttempts + 1,
      lastAttemptAt: now,
      updatedAt: now,
      lastError: "NO_API_KEY",
    };
  }

  /* ---------- request ---------- */
  const request = async (key) => {
    const { data } = await axios.post(
      `${baseUrl}/v1beta/models/${encodeURIComponent(model)}:embedContent?key=${encodeURIComponent(key)}`,
      {
        content: {
          parts: [{ text: trimmed }],
        },
      },
      { timeout: 25000 }
    );
    return data;
  };

  let data = null;
  let lastError = null;

  for (const key of apiKeys) {
    try {
      data = await request(key);
      break;
    } catch (err) {
      lastError = err?.message || "REQUEST_FAILED";
      if (!isRetryable(err)) break;
    }
  }

  const vector = data?.embedding?.values ?? null;

  /* ---------- invalid response ---------- */
  if (!Array.isArray(vector)) {
    return {
      status: "FAILED",
      dims: EXPECTED_EMBEDDING_DIMS,
      vector: null,
      attempts: prevAttempts + 1,
      lastAttemptAt: now,
      updatedAt: now,
      lastError: lastError || "INVALID_RESPONSE",
    };
  }

  /* ---------- dimension mismatch ---------- */
  if (vector.length !== EXPECTED_EMBEDDING_DIMS) {
    return {
      status: "FAILED",
      dims: vector.length,
      vector: null,
      attempts: prevAttempts + 1,
      lastAttemptAt: now,
      updatedAt: now,
      lastError: "DIM_MISMATCH",
    };
  }

  /* ---------- success ---------- */
  return {
    status: "READY",
    dims: EXPECTED_EMBEDDING_DIMS,
    vector,
    attempts: prevAttempts + 1,
    lastAttemptAt: now,
    updatedAt: now,
    lastError: null,
  };
};

export const EMBEDDING_DIMS = EXPECTED_EMBEDDING_DIMS;
