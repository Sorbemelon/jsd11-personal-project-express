import axios from "axios";

const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com";
const EMBEDDING_MODEL = "gemini-embedding-001";
const GENERATION_MODEL = "gemini-2.5-flash";
const EXPECTED_EMBEDDING_DIMS = 3072;

export const embedText = async ({
  apiKey = process.env.GEMINI_API_KEY,
  text,
  baseUrl = process.env.GEMINI_API_BASE_URL || DEFAULT_BASE_URL,
  model = process.env.GEMINI_EMBEDDING_MODEL || EMBEDDING_MODEL,
  timeoutMs = Number(process.env.GEMINI_HTTP_TIMEOUT_MS || 15000), // 15 seconds
} = {}) => {
  const trimmed = String(text || "").trim();

  if (!trimmed) {
    const error = new Error("embedText requires non-empty text");
    error.name = "ValidationError";
    error.status = 400;
    throw error;
  }

  if (!apiKey) {
    const error = new Error("GEMINI_API_KEY must be set to compute embeddings");
    error.name = "ConfigurationError";
    error.status = 500;
    throw error;
  }

  const url = `${baseUrl}/v1beta/models/${encodeURIComponent(
    model
  )}:embedContent?key=${encodeURIComponent(apiKey)}`;

  const { data } = await axios.post(
    url,
    {
      content: {
        parts: [{ text: trimmed }],
      },
    },
    {
      timeout: timeoutMs,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  const vector =
    data?.embedding?.values ||
    data?.embedding?.value ||
    data?.embeddings?.[0]?.values ||
    data?.embeddings?.[0]?.value;

  if (!Array.isArray(vector)) {
    const error = new Error("Unexpected Gemini embeddings response shape");
    error.name = "UpstreamError";
    error.status = 502;
    error.details = { receivedKeys: data ? Object.keys(data) : null };
    throw error;
  }

  if (vector.length !== EXPECTED_EMBEDDING_DIMS) {
    const error = new Error(
      `Embedding dimension mismatch: expected ${EXPECTED_EMBEDDING_DIMS}, got ${vector.length}`
    );
    error.name = "UpstreamError";
    error.status = 502;
    throw error;
  }

  return vector;
};

export const GEMINI_EMBEDDING_DIMS = EXPECTED_EMBEDDING_DIMS;

export const generateText = async ({
  apiKey = process.env.GEMINI_API_KEY,
  prompt,
  baseUrl = process.env.GEMINI_API_BASE_URL || DEFAULT_BASE_URL,
  model = process.env.GEMINI_GENERATION_MODEL || GENERATION_MODEL,
  timeoutMs = Number(process.env.GEMINI_HTTP_TIMEOUT_MS || 20000), // 20 seconds
  temperature = Number(process.env.GEMINI_TEMPERATURE || 0.2),
} = {}) => {
  const trimmed = String(prompt || "").trim();

  if (!trimmed) {
    const error = new Error("generateText requires non-empty prompt");
    error.name = "ValidationError";
    error.status = 400;
    throw error;
  }

  if (!apiKey) {
    const error = new Error("GEMINI_API_KEY must be set to generate response");
    error.name = "ConfigurationError";
    error.status = 500;
    throw error;
  }

  const url = `${baseUrl}/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const { data } = await axios.post(
    url,
    {
      contents: [
        {
          role: "user",
          parts: [{ text: trimmed }],
        },
      ],
      generationConfig: {
        temperature,
      },
    },
    {
      timeout: timeoutMs,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  const parts = data?.candidates?.[0]?.content?.parts;
  const text = Array.isArray(parts)
    ? parts
        .map((p) => p?.text)
        .filter(Boolean)
        .join("")
    : null;

  if (!text) {
    const error = new Error("Unexpected Gemini generateContent response shape");
    error.name = "UpstreamError";
    error.status = 502;
    error.details = { receivedKeys: data ? Object.keys(data) : null };

    throw error;
  }

  return String(text).trim();
};
