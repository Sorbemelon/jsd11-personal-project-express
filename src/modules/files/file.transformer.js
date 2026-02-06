import path from "path";
import pdf from "pdf-parse/lib/pdf-parse.js";
import mammoth from "mammoth";
import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import Tesseract from "tesseract.js";
import { AppError } from "../../utils/error.js";

export const transformFileToChunks = async (file, options = {}) => {
  const ext = path.extname(file.originalname).toLowerCase();

  let rawJson;
  let text = "";
  let chunks = [];

  switch (ext) {
    /* ================= TEXT LIKE ================= */

    case ".txt":
    case ".md":
    case ".html": {
      text = file.buffer.toString("utf-8");
      rawJson = { text };
      chunks = chunkParagraphs(text, { size: 600, overlap: 80 });
      break;
    }

    case ".json": {
      const content = file.buffer.toString("utf-8");
      const parsed = JSON.parse(content);

      text = JSON.stringify(parsed, null, 2);
      rawJson = parsed;

      chunks = chunkJSON(parsed);
      break;
    }

    /* ================= PDF ================= */

    case ".pdf": {
      const result = await parsePDF(file.buffer);

      text = result.text || "";
      rawJson = {
        metadata: result.metadata ?? null,
        pages: result.numpages ?? null,
      };

      chunks = chunkParagraphs(text, { size: 800, overlap: 120 });
      break;
    }

    /* ================= DOCX ================= */

    case ".docx": {
      const result = await mammoth.extractRawText({ buffer: file.buffer });

      text = result.value;
      rawJson = { messages: result.messages };

      chunks = chunkParagraphs(text, { size: 700, overlap: 100 });
      break;
    }

    /* ================= CSV / TSV ================= */

    case ".csv": {
      const result = parseCSV(file.buffer, ",");
      text = result.text;
      rawJson = result.rows;

      chunks = chunkRows(result.rows, { rowsPerChunk: 30 });
      break;
    }

    case ".tsv": {
      const result = parseCSV(file.buffer, "\t");
      text = result.text;
      rawJson = result.rows;

      chunks = chunkRows(result.rows, { rowsPerChunk: 30 });
      break;
    }

    /* ================= EXCEL ================= */

    case ".xlsx":
    case ".xls": {
      const result = parseExcel(file.buffer);
      text = result.text;
      rawJson = result.sheets;

      chunks = chunkExcelSheets(result.sheets);
      break;
    }

    /* ================= PPTX ================= */

    case ".pptx": {
      const result = await parsePPTX(file.buffer);
      text = result.text;
      rawJson = result.slides;

      chunks = chunkSlides(result.slides);
      break;
    }

    /* ================= IMAGE OCR ================= */

    case ".png":
    case ".jpg":
    case ".jpeg": {
      const result = await parseImageOCR(file.buffer);

      text = result.text;
      rawJson = { confidence: result.confidence };

      chunks = chunkParagraphs(text, { size: 300, overlap: 40 });
      break;
    }

    default:
      throw new AppError(`Unsupported file type: ${ext}`, 400);
  }

  const normalized = normalizeText(text);

  return {
    content: normalized,
    rawJson,
    chunks,
  };
};

/* ---------------- PDF ---------------- */

const parsePDF = async (buffer) => {
  try {
    const data = await pdf(buffer);

    if (!data?.text || data.text.trim().length === 0) {
      return {
        text: "",
        numpages: data?.numpages ?? null,
        metadata: data?.metadata ?? null,
      };
    }

    return data;
  } catch {
    throw new AppError("Failed to parse PDF file", 400);
  }
};

/* ---------------- CSV / TSV ---------------- */

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

/* ---------------- EXCEL ---------------- */

const parseExcel = (buffer) => {
  try {
    const workbook = XLSX.read(buffer, { type: "buffer" });

    const sheets = {};
    const textParts = [];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      sheets[sheetName] = json;

      const sheetText = json.map((row) => row.join(" | ")).join("\n");
      textParts.push(`Sheet: ${sheetName}\n${sheetText}`);
    }

    return {
      sheets,
      text: textParts.join("\n\n"),
    };
  } catch {
    throw new AppError("Failed to parse Excel file", 400);
  }
};

/* ---------------- PPTX ---------------- */

const parsePPTX = async (buffer) => {
  try {
    const zip = await JSZip.loadAsync(buffer);

    const slideFiles = Object.keys(zip.files)
      .filter((f) => f.startsWith("ppt/slides/slide"))
      .sort();

    const slides = [];
    const textParts = [];

    for (const slidePath of slideFiles) {
      const xml = await zip.files[slidePath].async("string");
      const matches = [...xml.matchAll(/<a:t>(.*?)<\/a:t>/g)].map((m) => m[1]);

      const slideText = matches.join(" ");

      slides.push({ slide: slides.length + 1, text: slideText });
      textParts.push(`Slide ${slides.length}: ${slideText}`);
    }

    return {
      slides,
      text: textParts.join("\n\n"),
    };
  } catch {
    throw new AppError("Failed to parse PowerPoint file", 400);
  }
};

/* ---------------- IMAGE OCR ---------------- */

const parseImageOCR = async (buffer) => {
  try {
    const { data } = await Tesseract.recognize(buffer, "eng", {
      logger: () => {},
    });

    return {
      text: data.text || "",
      confidence: data.confidence ?? null,
    };
  } catch {
    throw new AppError("Failed to perform OCR on image", 400);
  }
};

/* ---------------- NORMALIZATION ---------------- */

const normalizeText = (text) => text.replace(/\s+/g, " ").trim();

/* ============================================================
   SMART CHUNKING HELPERS (per file structure)
============================================================ */

const chunkParagraphs = (text, { size = 600, overlap = 80 } = {}) => {
  if (!text) return [];

  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

  return slidingWindowChunks(paragraphs.join("\n\n"), size, overlap);
};

const slidingWindowChunks = (text, chunkSize, overlap) => {
  if (overlap >= chunkSize) {
    throw new AppError("overlap must be smaller than chunkSize", 400);
  }

  const chunks = [];
  let start = 0;

  while (start < text.length) {
    const end = start + chunkSize;

    chunks.push({ content: text.slice(start, end) });

    start += chunkSize - overlap;
  }

  return chunks.filter((c) => c.content.length > 0);
};

/* ---------------- JSON ---------------- */

const chunkJSON = (obj) => {
  if (Array.isArray(obj)) {
    return obj.map((item, i) => ({
      content: JSON.stringify(item),
      metadata: { index: i },
    }));
  }

  return Object.entries(obj).map(([key, value]) => ({
    content: JSON.stringify({ [key]: value }),
    metadata: { key },
  }));
};

/* ---------------- CSV / TSV rows ---------------- */

const chunkRows = (rows, { rowsPerChunk = 30 } = {}) => {
  const chunks = [];

  for (let i = 0; i < rows.length; i += rowsPerChunk) {
    const slice = rows.slice(i, i + rowsPerChunk);

    chunks.push({
      content: slice.map((r) => r.join(" | ")).join("\n"),
      metadata: { rowStart: i, rowEnd: i + slice.length - 1 },
    });
  }

  return chunks;
};

/* ---------------- Excel sheets ---------------- */

const chunkExcelSheets = (sheets) => {
  const chunks = [];

  for (const [sheetName, rows] of Object.entries(sheets)) {
    const rowChunks = chunkRows(rows, { rowsPerChunk: 25 });

    rowChunks.forEach((c) => {
      chunks.push({
        ...c,
        metadata: { ...c.metadata, sheet: sheetName },
      });
    });
  }

  return chunks;
};

/* ---------------- PPT slides ---------------- */

const chunkSlides = (slides) => {
  return slides.map((s) => ({
    content: s.text,
    metadata: { slide: s.slide },
  }));
};
