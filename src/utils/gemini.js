import { GoogleGenerativeAI } from "@google/generative-ai";
import { AppError } from "./error.js";

/* ======================================================
   Load & validate API keys
====================================================== */

const GEMINI_KEYS = [
  process.env.GEMINI_API_KEY1,
  process.env.GEMINI_API_KEY2,
  process.env.GEMINI_API_KEY3,
  process.env.GEMINI_API_KEY4,
  process.env.GEMINI_API_KEY5,
].filter(Boolean);

if (!GEMINI_KEYS.length) {
  throw new Error("No Gemini API keys configured");
}

/* ======================================================
   Simple round-robin key rotation
====================================================== */

let keyIndex = 0;

const getNextClient = () => {
  const apiKey = GEMINI_KEYS[keyIndex];
  keyIndex = (keyIndex + 1) % GEMINI_KEYS.length;
  return new GoogleGenerativeAI(apiKey);
};

/* ======================================================
   Gemini text generation
====================================================== */

export const generateGeminiText = async ({ prompt }) => {
  if (!prompt || !prompt.trim()) {
    throw new AppError("Prompt is required for Gemini", 400);
  }

  let lastError = null;

  for (let attempt = 0; attempt < GEMINI_KEYS.length; attempt++) {
    try {
      const genAI = getNextClient();

      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
      });

      const result = await model.generateContent(prompt);
      const response = result?.response?.text?.();

      if (!response) {
        throw new Error("Empty Gemini response");
      }

      return response;
    } catch (error) {
      lastError = error;

      console.error("Gemini attempt failed", {
        attempt: attempt + 1,
        message: error?.message,
      });

      // try next key
    }
  }

  throw new AppError(
    "All Gemini API keys failed. Please try again later.",
    503
  );
};
