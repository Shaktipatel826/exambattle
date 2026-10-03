import path from 'path';
import { supabaseAdmin, supabaseServer } from '../lib/supabaseServer.js';
import { processUploadedFile } from './fileProcessor.js';

/**
 * Uploads an admin document file to Supabase Storage bucket 'study-materials'
 * and extracts raw text + metadata safely.
 */
export const uploadAndProcessDocument = async ({
  filePath,
  originalName,
  mimeType,
  fileSize,
  userId,
  userName,
  subject,
  topic,
  exam
}) => {
  // 1. Filename sanitization against path traversal
  const sanitizedOriginalName = originalName.replace(/[^a-zA-Z0-9.\-_]/g, '_');
  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
  const ext = path.extname(sanitizedOriginalName).toLowerCase();
  const storagePath = `admin-materials/${uniqueSuffix}_${sanitizedOriginalName}`;

  // Allowed extension check
  const allowedExts = ['.txt', '.csv', '.pdf', '.docx', '.xlsx', '.json'];
  if (!allowedExts.includes(ext)) {
    throw new Error(`Invalid file extension ${ext}. Allowed formats: TXT, CSV, PDF, DOCX, XLSX, JSON.`);
  }

  // File size validation (25MB limit)
  if (fileSize > 25 * 1024 * 1024) {
    throw new Error(`File size ${Math.round(fileSize / (1024 * 1024))}MB exceeds max limit of 25MB.`);
  }

  // 2. Server-side text extraction & cleaning
  const extracted = await processUploadedFile(filePath, originalName);

  // 3. Upload file to Supabase Storage if Supabase Admin client available
  let remoteStoragePath = storagePath;
  if (supabaseAdmin) {
    try {
      const fs = await import('fs');
      const fileBuffer = fs.readFileSync(filePath);
      const { data: uploadRes, error: uploadErr } = await supabaseAdmin.storage
        .from('study-materials')
        .upload(storagePath, fileBuffer, {
          contentType: mimeType || 'application/octet-stream',
          upsert: true
        });

      if (!uploadErr && uploadRes) {
        remoteStoragePath = uploadRes.path;
      }
    } catch (sbErr) {
      console.warn(`[Supabase Storage Notice] ${sbErr.message}`);
    }
  }

  // 4. Save metadata record in public.study_materials database table
  let metadataRecord = null;
  if (supabaseAdmin) {
    try {
      const { data: dbData, error: dbErr } = await supabaseAdmin
        .from('study_materials')
        .insert({
          uploaded_by: userId,
          uploader_name: userName || 'Admin',
          file_name: sanitizedOriginalName,
          storage_path: remoteStoragePath,
          file_size_bytes: fileSize,
          file_type: ext.replace('.', '').toUpperCase(),
          subject: subject || 'General Studies',
          topic: topic || 'General',
          exam: exam || 'General',
          extracted_text: extracted.cleanedText.substring(0, 15000), // Text sample
          char_count: extracted.charCount,
          processing_status: 'PROCESSED'
        })
        .select()
        .single();

      if (!dbErr) metadataRecord = dbData;
    } catch (dbEx) {
      console.warn(`[Study Material Database Sync Notice] ${dbEx.message}`);
    }
  }

  return {
    fileName: sanitizedOriginalName,
    storagePath: remoteStoragePath,
    fileSize,
    fileType: ext.replace('.', '').toUpperCase(),
    extractedText: extracted.cleanedText,
    charCount: extracted.charCount,
    wordCount: extracted.wordCount,
    transcriptItems: extracted.transcriptData || [],
    metadataRecord
  };
};

/**
 * Validates pasted text material size
 */
export const validatePastedText = (text, maxChars = 500000) => {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    throw new Error('Pasted text cannot be empty.');
  }

  const charCount = text.trim().length;
  if (charCount > maxChars) {
    throw new Error(`Pasted text size (${charCount.toLocaleString()} characters) exceeds maximum limit of ${maxChars.toLocaleString()} characters. Please attach as a file upload.`);
  }

  return {
    cleanedText: text.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').trim(),
    charCount,
    wordCount: text.split(/\s+/).filter(Boolean).length
  };
};
