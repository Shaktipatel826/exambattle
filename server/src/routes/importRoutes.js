import express from 'express';
import { upload, cleanupFile } from '../middleware/upload.js';
import { authMiddleware, adminGuard } from '../middleware/auth.js';
import { uploadAndProcessDocument, validatePastedText } from '../services/storageService.js';
import { processDocumentWithAI } from '../services/aiProcessing.js';
import { Question } from '../models/Question.js';

const router = express.Router();

// Admin-Only Bulk Document Upload & Supabase Storage Processing
router.post('/admin-upload', authMiddleware, adminGuard, upload.single('file'), async (req, res) => {
  let tempFilePath = null;
  try {
    let extractedText = '';
    let fileName = 'Pasted Text Document';
    let fileSize = 0;
    let fileType = 'TXT';
    let storagePath = 'pasted-text';
    let transcriptItems = [];

    if (req.file) {
      tempFilePath = req.file.path;
      fileName = req.file.originalname;
      fileSize = req.file.size;
      fileType = req.file.originalname.split('.').pop().toUpperCase();

      // Process via Storage Service (Supabase Storage upload + safe text extraction)
      const docResult = await uploadAndProcessDocument({
        filePath: req.file.path,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
        userId: req.user.id,
        userName: req.user.name,
        subject: req.body.subject,
        topic: req.body.topic,
        exam: req.body.exam
      });

      extractedText = docResult.extractedText;
      storagePath = docResult.storagePath;
      transcriptItems = docResult.transcriptItems;
    } else if (req.body.pastedText) {
      // Validate pasted text length
      const validated = validatePastedText(req.body.pastedText);
      extractedText = validated.cleanedText;
      fileSize = validated.charCount;
    } else {
      return res.status(400).json({ success: false, message: 'Please attach a document file (PDF, TXT, CSV, DOCX, XLSX) or paste transcript text.' });
    }

    const subject = req.body.subject || 'General Studies';
    const topic = req.body.topic || 'General';
    const exam = req.body.exam || 'General';

    // Run modular AI Processing pipeline
    const aiOutput = await processDocumentWithAI({
      extractedText,
      subject,
      topic,
      exam,
      sourceDocumentName: fileName,
      uploadedBy: req.user.name
    });

    // Save generated MCQs to Pending Review Queue (NEVER auto-publish to global question bank)
    const pendingQuestions = [];
    for (const q of aiOutput.generatedMCQs) {
      const newQ = await Question.create({
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        subject: q.subject,
        topic: q.topic,
        exam: q.exam,
        difficulty: q.difficulty,
        source: q.source,
        sourceType: q.sourceType,
        sourceReference: q.sourceReference,
        verified: false,
        status: 'PENDING_REVIEW', // Queued for Admin Review
        createdBy: req.user.name
      });
      pendingQuestions.push(newQ);
    }

    return res.json({
      success: true,
      message: `Document processed successfully! ${pendingQuestions.length} MCQs queued for Admin Review.`,
      fileInfo: {
        fileName,
        fileType,
        fileSize,
        storagePath,
        charCount: extractedText.length,
        transcriptCount: transcriptItems.length
      },
      summary: {
        notesCount: aiOutput.notes.length,
        oneLinersCount: aiOutput.oneLiners.length,
        conceptsCount: aiOutput.keyConcepts.length,
        mcqsGenerated: pendingQuestions.length,
        status: 'PENDING_ADMIN_REVIEW'
      },
      previewMCQs: pendingQuestions.slice(0, 3)
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    if (tempFilePath) {
      cleanupFile(tempFilePath);
    }
  }
});

// Admin-Only Bulk Structured Questions Import (JSON array or CSV file)
router.post('/bulk-questions', authMiddleware, adminGuard, upload.single('file'), async (req, res) => {
  let tempFilePath = null;
  try {
    let rawItems = [];

    if (req.file) {
      tempFilePath = req.file.path;
      const fs = await import('fs');
      const content = fs.readFileSync(req.file.path, 'utf-8');

      if (req.file.originalname.toLowerCase().endsWith('.json')) {
        try {
          rawItems = JSON.parse(content);
        } catch (e) {
          return res.status(400).json({ success: false, message: 'Invalid JSON file format.' });
        }
      } else {
        // Simple CSV parser fallback: line by line
        const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
        if (lines.length > 1) {
          const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
          for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
            if (cols.length >= 6) {
              rawItems.push({
                question: cols[0],
                options: [cols[1], cols[2], cols[3], cols[4]],
                correctAnswer: Number(cols[5]) || 0,
                explanation: cols[6] || '',
                subject: cols[7] || req.body.subject || 'General Studies',
                topic: cols[8] || req.body.topic || 'General',
                exam: cols[9] || req.body.exam || 'General',
                difficulty: cols[10] || 'Medium'
              });
            }
          }
        }
      }
    } else if (Array.isArray(req.body.questions)) {
      rawItems = req.body.questions;
    } else {
      return res.status(400).json({ success: false, message: 'Please attach a JSON/CSV file or send a questions array.' });
    }

    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid questions found to import.' });
    }

    let totalFound = rawItems.length;
    let valid = 0;
    let invalid = 0;
    let duplicates = 0;
    let needReview = 0;

    const importedQuestions = [];

    for (const item of rawItems) {
      if (!item.question || !Array.isArray(item.options) || item.options.length !== 4 || item.correctAnswer === undefined) {
        invalid++;
        continue;
      }

      // Check duplicate
      const existing = await Question.findOne({ question: item.question.trim() });
      const duplicateFlag = !!existing;
      if (duplicateFlag) duplicates++;

      const targetStatus = req.body.autoPublish === 'true' ? 'PUBLISHED' : 'PENDING_REVIEW';
      if (targetStatus === 'PENDING_REVIEW') needReview++;

      const newQ = await Question.create({
        question: item.question.trim(),
        options: item.options.map(o => String(o).trim()),
        correctAnswer: Number(item.correctAnswer),
        explanation: item.explanation || '',
        subject: item.subject || req.body.subject || 'General Studies',
        subSubject: item.subSubject || '',
        topic: item.topic || req.body.topic || 'General',
        exam: item.exam || req.body.exam || 'General',
        examYear: item.examYear ? Number(item.examYear) : null,
        difficulty: item.difficulty || 'Medium',
        sourceType: 'IMPORTED',
        source: 'Bulk File Import',
        verified: req.body.autoPublish === 'true',
        status: targetStatus,
        createdBy: req.user.name || 'Admin Bulk Import',
        duplicateFlag
      });

      valid++;
      importedQuestions.push(newQ);
    }

    return res.json({
      success: true,
      message: `Bulk import completed: ${valid} imported, ${duplicates} duplicates flagged.`,
      summary: {
        totalFound,
        valid,
        invalid,
        duplicates,
        needReview
      },
      previewCount: importedQuestions.length
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    if (tempFilePath) {
      cleanupFile(tempFilePath);
    }
  }
});

export default router;

