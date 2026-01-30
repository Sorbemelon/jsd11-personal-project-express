import path from "path";
import { PDFParse } from "pdf-parse";
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
      text = result.text;
      rawJson = {
        metadata: result.metadata,
        pages: result.numpages,
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

  const chunks = splitIntoChunks(text, options);

  return {
    content: normalizeText(text),
    rawJson,
    chunks,
  };
};

/* ---------------- parsers ---------------- */

const parseTXT = (buffer) => {
  return buffer.toString("utf-8");
};

const parsePDF = async (buffer) => {
  const parsed = await PDFParse(buffer);
  return parsed;
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
  const cleaned = normalizeText(text);

  const chunks = [];
  let start = 0;

  while (start < cleaned.length) {
    const end = start + chunkSize;

    chunks.push({
      content: cleaned.slice(start, end),
    });

    start += chunkSize - overlap;
  }

  return chunks.filter((c) => c.content.length > 0);
};