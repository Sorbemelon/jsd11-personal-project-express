import axios from "axios";

const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com";
const EMBEDDING_MODEL = "models/embedding-001";
const GENERATION_MODEL = "models/gemini-2.5-flash";
const EXPECTED_EMBEDDING_DIMS = 3072;

/* ======================================================
   HELPERS
====================================================== */

const isRetryableError = (err) => {
  const status = err?.response?.status;
  return (
    !status || // network error
    status === 429 || // rate limit
    (status >= 500 && status < 600)
  );
};

const buildApiKeys = (...keys) => keys.filter(Boolean);

/* ======================================================
   EMBEDDINGS
====================================================== */

export const embedText = async ({
  apiKey1 = process.env.GEMINI_API_KEY1,
  apiKey2 = process.env.GEMINI_API_KEY2,
  apiKey3 = process.env.GEMINI_API_KEY3,
  apiKey4 = process.env.GEMINI_API_KEY4,
  apiKey5 = process.env.GEMINI_API_KEY5,
  text,
  baseUrl = process.env.GEMINI_API_BASE_URL || DEFAULT_BASE_URL,
  model = process.env.GEMINI_EMBEDDING_MODEL || EMBEDDING_MODEL,
  timeoutMs = Number(process.env.GEMINI_HTTP_TIMEOUT_MS || 25000),
} = {}) => {
  const apiKeys = buildApiKeys(
    apiKey1,
    apiKey2,
    apiKey3,
    apiKey4,
    apiKey5
  );

  const trimmed = String(text || "").trim();
  if (!trimmed) {
    const err = new Error("embedText requires non-empty text");
    err.status = 400;
    throw err;
  }

  if (!apiKeys.length) {
    throw new Error("At least one GEMINI_API_KEY must be configured");
  }

  const requestEmbedding = async (key) => {
    const { data } = await axios.post(
      `${baseUrl}/v1beta/models/${model}:embedContent?key=${key}`,
      {
        contents: [
          {
            role: "user",
            parts: [{ text: trimmed }],
          },
        ],
      },
      { timeout: timeoutMs }
    );
    return data;
  };

  let data, lastError;

  for (const key of apiKeys) {
    try {
      data = await requestEmbedding(key);
      break;
    } catch (err) {
      lastError = err;
      if (!isRetryableError(err)) break;
    }
  }

  if (!data) {
    const err = new Error("Failed to compute embedding");
    err.status = 502;
    err.details = lastError?.response?.data;
    throw err;
  }

  const vector =
    data?.embedding?.values ||
    data?.embeddings?.[0]?.values;

  if (!Array.isArray(vector)) {
    throw new Error("Unexpected Gemini embedding response shape");
  }

  if (vector.length !== EXPECTED_EMBEDDING_DIMS) {
    throw new Error(
      `Embedding dims mismatch: expected ${EXPECTED_EMBEDDING_DIMS}, got ${vector.length}`
    );
  }

  return vector;
};

export const GEMINI_EMBEDDING_DIMS = EXPECTED_EMBEDDING_DIMS;

/* ======================================================
   TEXT GENERATION
====================================================== */

export const generateText = async ({
  apiKey1 = process.env.GEMINI_API_KEY1,
  apiKey2 = process.env.GEMINI_API_KEY2,
  apiKey3 = process.env.GEMINI_API_KEY3,
  apiKey4 = process.env.GEMINI_API_KEY4,
  apiKey5 = process.env.GEMINI_API_KEY5,
  prompt,
  systemInstruction,
  baseUrl = process.env.GEMINI_API_BASE_URL || DEFAULT_BASE_URL,
  model = process.env.GEMINI_GENERATION_MODEL || GENERATION_MODEL,
  timeoutMs = Number(process.env.GEMINI_HTTP_TIMEOUT_MS || 20000),
  temperature = Number(process.env.GEMINI_TEMPERATURE || 0.2),
  maxOutputTokens = Number(process.env.GEMINI_MAX_TOKENS || 1024),
} = {}) => {
  const apiKeys = buildApiKeys(
    apiKey1,
    apiKey2,
    apiKey3,
    apiKey4,
    apiKey5
  );

  const trimmed = String(prompt || "").trim();
  if (!trimmed) {
    throw new Error("generateText requires non-empty prompt");
  }

  const requestGeneration = async (key) => {
    const { data } = await axios.post(
      `${baseUrl}/v1beta/models/${model}:generateContent?key=${key}`,
      {
        systemInstruction: systemInstruction
          ? { parts: [{ text: systemInstruction }] }
          : undefined,
        contents: [
          {
            role: "user",
            parts: [{ text: trimmed }],
          },
        ],
        generationConfig: {
          temperature,
          maxOutputTokens,
        },
      },
      { timeout: timeoutMs }
    );
    return data;
  };

  let data, lastError;

  for (const key of apiKeys) {
    try {
      data = await requestGeneration(key);
      break;
    } catch (err) {
      lastError = err;
      if (!isRetryableError(err)) break;
    }
  }

  const text = data?.candidates?.[0]?.content?.parts
    ?.map((p) => p?.text)
    .filter(Boolean)
    .join("");

  if (!text) {
    const err = new Error("Invalid Gemini generation response");
    err.status = 502;
    err.details = lastError?.response?.data;
    throw err;
  }

  return text.trim();
};
