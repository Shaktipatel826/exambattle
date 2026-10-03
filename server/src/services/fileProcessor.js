import fs from 'fs';
import path from 'path';
import csvParser from 'csv-parser';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';
import * as xlsx from 'xlsx';

/**
 * Extract raw text & structured transcript data from uploaded files
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
    textContent = csvResult.fullText;
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

  // Clean and sanitize content
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

/**
 * Parses transcript CSV formatted as: start,end,text or start,end,"text"
 */

function parseCSVTranscript(filePath) {
  return new Promise((resolve, reject) => {
    const items = [];
    const fullTextArr = [];

    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on('data', (row) => {
        // Look for start, end, text columns (case-insensitive)
        const keys = Object.keys(row);
        const startKey = keys.find(k => k.toLowerCase().includes('start'));
        const endKey = keys.find(k => k.toLowerCase().includes('end'));
        const textKey = keys.find(k => k.toLowerCase().includes('text') || k.toLowerCase().includes('transcript') || k.toLowerCase().includes('content'));

        const text = textKey ? row[textKey] : Object.values(row).join(' ');
        const start = startKey ? row[startKey] : '';
        const end = endKey ? row[endKey] : '';

        if (text && text.trim()) {
          items.push({ start, end, text: text.trim() });
          fullTextArr.push(text.trim());
        }
      })
      .on('end', () => {
        resolve({
          fullText: fullTextArr.join(' '),
          items
        });
      })
      .on('error', (err) => {
        reject(err);
      });
  });
}
