import express from 'express';
import { upload, cleanupFile } from '../middleware/upload.js';
import { authMiddleware } from '../middleware/auth.js';
import { createRateLimiter } from '../middleware/rateLimiter.js';
import { processUploadedFile } from '../services/fileProcessor.js';
import {
  generateStudyPackWithAI,
  generateQuestionExplanation,
  generateSimilarQuestions,
  askAIStudyAssistant
} from '../services/gemini.js';
import { StudyPack } from '../models/StudyPack.js';

const router = express.Router();

// Rate limiter for AI endpoints (max 15 requests per 10 minutes per user)
const aiRateLimiter = createRateLimiter(10 * 60 * 1000, 15, 'AI Study Generation Rate Limit Exceeded.');

// Upload Material & Process AI Study Pack
router.post('/process-material', authMiddleware, aiRateLimiter, upload.single('file'), async (req, res) => {
  let uploadedFilePath = null;
  try {
    let contentText = req.body.pastedText || '';
    let fileName = 'Pasted Text Document';
    let fileType = 'TXT';

    if (req.file) {
      uploadedFilePath = req.file.path;
      fileName = req.file.originalname;
      fileType = req.file.originalname.split('.').pop().toUpperCase();
      const processed = await processUploadedFile(req.file.path, req.file.originalname);
      contentText = processed.cleanedText;
    }

    if (!contentText || contentText.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Please upload a file or paste study material text.' });
    }

    const subject = req.body.subject || 'General Studies';
    const topic = req.body.topic || 'General Topic';

    // Call Gemini AI service
    const aiOutput = await generateStudyPackWithAI(contentText, subject, topic);

    const newStudyPack = await StudyPack.create({
      title: req.body.title || `AI Study Pack - ${fileName}`,
      userId: req.user.id,
      fileName,
      fileType,
      sourceType: 'SOURCE_BASED',
      rawContentText: contentText.substring(0, 10000),
      shortNotes: aiOutput.shortNotes,
      oneLiners: aiOutput.oneLiners,
      keyConcepts: aiOutput.keyConcepts,
      importantPoints: aiOutput.importantPoints,
      commonConfusions: aiOutput.commonConfusions,
      originalQuestions: aiOutput.originalQuestions || [],
      newMCQs: aiOutput.newMCQs,
      revisionQuestions: aiOutput.revisionQuestions,
      processingStatus: 'COMPLETED',
      processingProgress: 100
    });

    return res.status(201).json({
      success: true,
      message: 'AI Study Pack created successfully!',
      studyPack: newStudyPack
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    // Safe temporary file cleanup
    if (uploadedFilePath) {
      cleanupFile(uploadedFilePath);
    }
  }
});

// Get User's AI Study Packs (Filtered by user ID)
router.get('/study-packs', authMiddleware, async (req, res) => {
  try {
    const packs = await StudyPack.find({ userId: req.user.id }).sort({ createdAt: -1 });
    return res.json({ success: true, studyPacks: packs });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// Get Single AI Study Pack Details (Access Control Guard)
router.get('/study-packs/:id', authMiddleware, async (req, res) => {
  try {
    const pack = await StudyPack.findById(req.params.id);
    if (!pack) {
      return res.status(404).json({ success: false, message: 'Study pack not found.' });
    }

    // Access control check: user must own pack or be ADMIN
    if (pack.userId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Access denied to private study pack.' });
    }

    return res.json({ success: true, studyPack: pack });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// AI Question Explanation ("WHY?")
router.post('/explain', authMiddleware, aiRateLimiter, async (req, res) => {
  try {
    const { questionText, options, correctAnswerIndex, userSelectedIndex } = req.body;
    const explanation = await generateQuestionExplanation(questionText, options, correctAnswerIndex, userSelectedIndex);
    return res.json({ success: true, explanation });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// Generate Similar Questions
router.post('/similar-questions', authMiddleware, aiRateLimiter, async (req, res) => {
  try {
    const { questionText, subject, topic } = req.body;
    const questions = await generateSimilarQuestions(questionText, subject || 'Polity', topic || 'General', 3);
    return res.json({ success: true, questions });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// AI Study Assistant Chat
router.post('/assistant-chat', authMiddleware, aiRateLimiter, async (req, res) => {
  try {
    const { prompt, context } = req.body;
    const reply = await askAIStudyAssistant(prompt, context || '');
    return res.json({ success: true, reply });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ==================================================
// ADMIN AI CONTENT GENERATION ENGINE ENDPOINTS (Phase 7)
// ==================================================
import { adminGuard } from '../middleware/auth.js';
import { AIJob } from '../models/AIJob.js';
import { processAIContentJob } from '../services/ai/chunkProcessor.js';
import { uploadAndProcessDocument, validatePastedText } from '../services/storageService.js';

// 1. Admin Start AI Processing Job
router.post('/admin-generate-job', authMiddleware, adminGuard, upload.single('file'), async (req, res) => {
  let tempFilePath = null;
  try {
    let extractedText = '';
    let sourceDocumentName = 'Pasted Transcript';

    if (req.file) {
      tempFilePath = req.file.path;
      sourceDocumentName = req.file.originalname;

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
    } else if (req.body.pastedText) {
      const val = validatePastedText(req.body.pastedText);
      extractedText = val.cleanedText;
    } else {
      return res.status(400).json({ success: false, message: 'Please upload a document file (PDF/TXT/DOCX) or paste text.' });
    }

    if (!extractedText || extractedText.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'No readable text extracted from provided source.' });
    }

    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const generationType = req.body.generationType || 'ALL';
    const subject = req.body.subject || 'General Studies';
    const topic = req.body.topic || 'General';
    const exam = req.body.exam || 'General';
    const difficulty = req.body.difficulty || 'Medium';
    const mcqCount = Number(req.body.mcqCount || 5);

    // Initial Job Creation
    const job = await AIJob.create({
      jobId,
      sourceDocumentName,
      createdBy: req.user.name || 'Admin',
      provider: 'Gemini',
      model: 'gemini-3.8-flash',
      status: 'QUEUED',
      generationType,
      subject,
      topic,
      exam,
      difficulty,
      totalChars: extractedText.length
    });

    // Run Chunk Processor Pipeline
    const processedJob = await processAIContentJob({
      jobId,
      extractedText,
      generationType,
      subject,
      topic,
      exam,
      difficulty,
      mcqCount,
      createdBy: req.user.name || 'Admin'
    });

    return res.status(201).json({
      success: true,
      message: `AI Job completed! Generated ${processedJob.generatedMcqCount} MCQs, ${processedJob.generatedOneLinersCount} One-Liners, and Study Notes.`,
      job: processedJob
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    if (tempFilePath) {
      cleanupFile(tempFilePath);
    }
  }
});

// 2. Admin Get List of AI Jobs
router.get('/admin-jobs', authMiddleware, adminGuard, async (req, res) => {
  try {
    const jobs = await AIJob.find({}).sort({ createdAt: -1 }).limit(20);
    return res.json({ success: true, jobs });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// 3. Admin Get Single AI Job Details
router.get('/admin-jobs/:jobId', authMiddleware, adminGuard, async (req, res) => {
  try {
    const job = await AIJob.findOne({ jobId: req.params.jobId });
    if (!job) {
      return res.status(404).json({ success: false, message: 'AI Job not found.' });
    }
    return res.json({ success: true, job });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

export default router;

