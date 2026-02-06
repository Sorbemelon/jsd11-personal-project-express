import rateLimit from "express-rate-limit";

const isProd = process.env.NODE_ENV === "production";

/* GENERAL API LIMITER */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProd ? 100 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
});

/* AUTH / LOGIN LIMITER (STRICT) */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProd ? 10 : 100, // strict in prod, relaxed in dev
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message:
      "Too many login attempts. Please wait a few minutes and try again.",
  },
});
