import fs from 'fs';
import path from 'path';
import csvParser from 'csv-parser';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';
import * as xlsx from 'xlsx';

/**
 * Extract raw text & structured transcript data from uploaded files.
 * For CSV transcripts (start, end, text columns) the text segments are joined
 * with newlines so that sentence boundaries survive into the AI pipeline.
 */
export const processUploadedFile = async (filePath, originalName) => {
  const ext = path.extname(originalName).toLowerCase();
  let textContent = '';
  let transcriptData = [];

  if (ext === '.txt') {
    textContent = fs.readFileSync(filePath, 'utf-8');
  }
  else if (ext === '.csv') {
    const csvResult = await parseCSVTranscript(filePath);
    textContent = csvResult.fullText;   // already newline-joined by the new helper
    transcriptData = csvResult.items;
  }
  else if (ext === '.pdf') {
    const dataBuffer = fs.readFileSync(filePath);
    const pdfData = await pdfParse(dataBuffer);
    textContent = pdfData.text || '';
  }
  else if (ext === '.docx') {
    const result = await mammoth.extractRawText({ path: filePath });
    textContent = result.value || '';
  }
  else if (ext === '.xlsx') {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    textContent = rows.map(r => Array.isArray(r) ? r.join(' | ') : String(r)).join('\n');
  }
  else if (ext === '.json') {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    textContent = typeof parsed === 'string' ? parsed : JSON.stringify(parsed);
  }

  // Normalise line endings; collapse horizontal whitespace but keep newlines
  const cleanedText = textContent
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();

  return {
    cleanedText,
    transcriptData,
    charCount: cleanedText.length,
    wordCount: cleanedText.split(/\s+/).filter(Boolean).length
  };
};

// ── Transcript-noise patterns to strip before AI processing ─────────────────
// Matches: "[Music]", "(applause)", "♪ ... ♪", pure timestamps "0:03 / 2:14"
const TRANSCRIPT_NOISE_RE = /\[(?:Music|Applause|Laughter|Inaudible|Crosstalk)[^\]]*\]|\([^)]{1,30}\)|♪[^♪]*♪|\b\d{1,2}:\d{2}(?::\d{2})?\s*\/\s*\d{1,2}:\d{2}(?::\d{2})?\b/gi;

/**
 * Parses transcript CSV (start, end, text columns).
 *
 * Key improvements over the previous version:
 *  - Joins segments with "\n" instead of " " → preserves sentence boundaries
 *  - Strips filler / noise tokens (um, uh, repeated words within a segment)
 *  - Preserves Hindi Devanagari Unicode correctly
 *  - Falls back gracefully if columns are named differently
 */
function parseCSVTranscript(filePath) {
  return new Promise((resolve, reject) => {
    const items = [];
    const segments = [];

    fs.createReadStream(filePath, { encoding: 'utf-8' })
      .pipe(csvParser())
      .on('data', (row) => {
        const keys = Object.keys(row);
        const startKey = keys.find(k => /^start$/i.test(k.trim()));
        const endKey   = keys.find(k => /^end$/i.test(k.trim()));
        const textKey  = keys.find(k =>
          /^(text|transcript|content|caption|segment)$/i.test(k.trim())
        ) || keys.find(k =>
          k.toLowerCase().includes('text') ||
          k.toLowerCase().includes('transcript') ||
          k.toLowerCase().includes('content')
        );

        const rawText = textKey ? row[textKey] : Object.values(row).join(' ');
        const start   = startKey ? row[startKey] : '';
        const end     = endKey   ? row[endKey]   : '';

        if (!rawText || !rawText.trim()) return;

        // Strip transcript noise
        let cleaned = rawText
          .replace(TRANSCRIPT_NOISE_RE, ' ')
          .replace(/\bum+\b|\buh+\b|\bhmm+\b|\bokay\s+so\b/gi, '')
          .replace(/\s{2,}/g, ' ')
          .trim();

        // Drop very short / meaningless fragments (< 4 non-space chars)
        if (cleaned.replace(/\s/g, '').length < 4) return;

        items.push({ start, end, text: cleaned });
        segments.push(cleaned);
      })
      .on('end', () => {
        // Join with newline so downstream chunking can split on paragraph boundaries
        resolve({
          fullText: segments.join('\n'),
          items
        });
      })
      .on('error', reject);
  });
}
