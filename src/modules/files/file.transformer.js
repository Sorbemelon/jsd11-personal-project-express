import path from "path";
import pdf from "pdf-parse/lib/pdf-parse.js";
import mammoth from "mammoth";
import { parse } from "csv-parse/sync";
import { AppError } from "../../utils/error.js";

/**
 * Main entry
 * Converts uploaded file (buffer) → normalized text + JSON + chunks
 */
export const transformFileToChunks = async (file, options = {}) => {
  const ext = path.extname(file.originalname).toLowerCase();

  let rawJson;
  let text = "";

  switch (ext) {
    case ".txt": {
      text = parseTXT(file.buffer);
      rawJson = { text };
      break;
    }

    case ".pdf": {
      const result = await parsePDF(file.buffer);
      text = result.text || "";
      rawJson = {
        metadata: result.metadata ?? null,
        pages: result.numpages ?? null,
      };
      break;
    }

    case ".docx": {
      const result = await parseDOCX(file.buffer);
      text = result.text;
      rawJson = result.raw;
      break;
    }

    case ".csv": {
      const result = parseCSV(file.buffer, ",");
      text = result.text;
      rawJson = result.rows;
      break;
    }

    case ".tsv": {
      const result = parseCSV(file.buffer, "\t");
      text = result.text;
      rawJson = result.rows;
      break;
    }

    default:
      throw new AppError(`Unsupported file type: ${ext}`, 400);
  }

  const normalized = normalizeText(text);
  const chunks = splitIntoChunks(normalized, options);

  return {
    content: normalized,
    rawJson,
    chunks,
  };
};

/* ---------------- parsers ---------------- */

const parseTXT = (buffer) => {
  return buffer.toString("utf-8");
};

/**
 * Stable PDF parser using pdf-parse v1 runtime entry
 * Avoids test harness import crash in ESM
 */
const parsePDF = async (buffer) => {
  try {
    const data = await pdf(buffer);

    // Guard against scanned PDFs returning empty text
    if (!data?.text || data.text.trim().length === 0) {
      return {
        text: "",
        numpages: data?.numpages ?? null,
        metadata: data?.metadata ?? null,
      };
    }

    return data;
  } catch (err) {
    throw new AppError("Failed to parse PDF file", 400);
  }
};

const parseDOCX = async (buffer) => {
  const result = await mammoth.extractRawText({ buffer });

  return {
    text: result.value,
    raw: {
      messages: result.messages,
    },
  };
};

const parseCSV = (buffer, delimiter) => {
  const content = buffer.toString("utf-8");

  const records = parse(content, {
    delimiter,
    skip_empty_lines: true,
  });

  return {
    rows: records,
    text: records.map((row) => row.join(" | ")).join("\n"),
  };
};

/* ---------------- normalization ---------------- */

const normalizeText = (text) => {
  return text.replace(/\s+/g, " ").trim();
};

/* ---------------- chunking ---------------- */

/**
 * Splits text into embedding-friendly chunks
 */
const splitIntoChunks = (
  text,
  { chunkSize = 500, overlap = 50 } = {}
) => {
  if (!text) return [];

  if (overlap >= chunkSize) {
    throw new AppError("overlap must be smaller than chunkSize", 400);
  }

  const chunks = [];
  let start = 0;

  while (start < text.length) {
    const end = start + chunkSize;

    chunks.push({
      content: text.slice(start, end),
    });

    start += chunkSize - overlap;
  }

  return chunks.filter((c) => c.content.length > 0);
};