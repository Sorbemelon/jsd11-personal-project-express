import fs from "fs/promises";
import path from "path";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import { parse } from "csv-parse/sync";
import { AppError } from "../../utils/error.js";

/**
 * Main entry
 * Converts uploaded file → normalized text chunks
 */
export const transformFileToChunks = async (file, options = {}) => {
  const ext = path.extname(file.originalname).toLowerCase();

  let text = "";

  switch (ext) {
    case ".txt":
      text = await parseTXT(file.path);
      break;

    case ".pdf":
      text = await parsePDF(file.path);
      break;

    case ".docx":
      text = await parseDOCX(file.path);
      break;

    case ".csv":
      text = await parseCSV(file.path, ",");
      break;

    case ".tsv":
      text = await parseCSV(file.path, "\t");
      break;

    default:
      throw new AppError(
        `Unsupported file type: ${ext}`,
        400
      );
  }

  return splitIntoChunks(text, options);
};

/* ---------------- parsers ---------------- */

const parseTXT = async (filePath) => {
  return fs.readFile(filePath, "utf-8");
};

const parsePDF = async (filePath) => {
  const buffer = await fs.readFile(filePath);
  const parsed = await PDFParse(buffer);
  return parsed.text;
};

const parseDOCX = async (filePath) => {
  const result = await mammoth.extractRawText({
    path: filePath,
  });
  return result.value;
};

const parseCSV = async (filePath, delimiter) => {
  const content = await fs.readFile(filePath, "utf-8");
  const records = parse(content, {
    delimiter,
    skip_empty_lines: true,
  });

  // Convert rows → readable text
  return records.map(row => row.join(" | ")).join("\n");
};

/* ---------------- chunking ---------------- */

/**
 * Splits text into embedding-friendly chunks
 */
const splitIntoChunks = (
  text,
  {
    chunkSize = 500,
    overlap = 50,
  } = {}
) => {
  const cleaned = text
    .replace(/\s+/g, " ")
    .trim();

  const chunks = [];
  let start = 0;

  while (start < cleaned.length) {
    const end = start + chunkSize;

    chunks.push({
      content: cleaned.slice(start, end),
    });

    start += chunkSize - overlap;
  }

  return chunks.filter(c => c.content.length > 0);
};