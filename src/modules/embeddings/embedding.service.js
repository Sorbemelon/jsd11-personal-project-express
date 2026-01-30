// src/modules/embeddings/embedding.service.js
import axios from "axios";

const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com";
const EMBEDDING_MODEL = "models/embedding-001";
const EXPECTED_DIMS = 3072;

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
 * Embed a single text chunk (SAFE)
 */
export const embedText = async (text) => {
  const trimmed = String(text || "").trim();

  if (!trimmed) {
    return {
      status: "SKIPPED",
      reason: "EMPTY_TEXT",
      vector: null,
    };
  }

  const apiKeys = getApiKeys();
  if (!apiKeys.length) {
    return {
      status: "ERROR",
      reason: "NO_API_KEY",
      vector: null,
    };
  }

  const request = async (key) => {
    const { data } = await axios.post(
      `${DEFAULT_BASE_URL}/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${key}`,
      {
        contents: [
          {
            role: "user",
            parts: [{ text: trimmed }],
          },
        ],
      },
      { timeout: 25000 }
    );
    return data;
  };

  let data = null;

  for (const key of apiKeys) {
    try {
      data = await request(key);
      break;
    } catch (err) {
      if (!isRetryable(err)) break;
    }
  }

  const vector =
    data?.embedding?.values ||
    data?.embeddings?.[0]?.values ||
    null;

  if (!Array.isArray(vector)) {
    return {
      status: "ERROR",
      reason: "INVALID_RESPONSE",
      vector: null,
    };
  }

  if (vector.length !== EXPECTED_DIMS) {
    return {
      status: "ERROR",
      reason: "DIM_MISMATCH",
      vector: null,
    };
  }

  return {
    status: "READY",
    vector,
  };
};

export const EMBEDDING_DIMS = EXPECTED_DIMS;
