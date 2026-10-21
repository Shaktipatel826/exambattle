/**
 * Doc-to-Test API Routes
 *
 * POST /api/ai/doc-to-test
 *   Accept: file upload (PDF/TXT/DOCX) OR pastedText in body
 *   Auth: Required (any logged-in user with ADMIN or STUDENT role)
 *   Returns: preview question array + pipeline stats (NOT yet saved)
 *
 * POST /api/ai/doc-to-test/save
 *   Auth: ADMIN only
 *   Body: { questions[], roomConfig? }
 *   Saves questions to MongoDB + optionally returns room info
 *
 * GET /api/ai/doc-to-test/status
 *   Returns: configured AI provider status (which keys are present)
 */

import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authMiddleware, adminGuard } from '../middleware/auth.js';
import { processUploadedFile } from '../services/fileProcessor.js';
import { validatePastedText } from '../services/storageService.js';
import { runDocToTestPipeline, validateAndSaveQuestions } from '../services/multiAIPipeline.js';

const router = express.Router();

// Multer setup: temp upload to /uploads/doc-to-test/
const uploadDir = path.join(process.cwd(), 'uploads', 'doc-to-test');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}_${safe}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['.pdf', '.txt', '.docx', '.csv', '.xlsx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${ext}. Accepted: ${allowed.join(', ')}`));
    }
  }
});

function cleanupFile(filePath) {
  if (filePath && fs.existsSync(filePath)) {
    try { fs.unlinkSync(filePath); } catch {}
  }
}

// ─── GET /api/ai/doc-to-test/status ──────────────────────────────────────────

router.get('/status', authMiddleware, (_req, res) => {
  const geminiConfigured = !!(
    process.env.GEMINI_API_KEY &&
    process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here' &&
    process.env.GEMINI_API_KEY.trim().length > 0
  );
  const groqConfigured = !!(
    process.env.GROQ_API_KEY &&
    process.env.GROQ_API_KEY !== 'your_groq_api_key_here' &&
    process.env.GROQ_API_KEY.trim().length > 0
  );
  const openRouterConfigured = !!(
    process.env.OPENROUTER_API_KEY &&
    process.env.OPENROUTER_API_KEY !== 'your_openrouter_api_key_here' &&
    process.env.OPENROUTER_API_KEY.trim().length > 0
  );

  return res.json({
    success: true,
    providers: {
      gemini: { configured: geminiConfigured, role: 'Question Generator' },
      groq: { configured: groqConfigured, role: 'Distractor Generator', model: process.env.GROQ_MODEL || 'qwen/qwen3.8-27b' },
      openRouter: { configured: openRouterConfigured, role: 'Answer Verifier', model: process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.1-8b-instruct' }
    },
    pipelineReady: geminiConfigured && groqConfigured
  });
});

// ─── POST /api/ai/doc-to-test ─────────────────────────────────────────────────

router.post('/', authMiddleware, upload.single('file'), async (req, res) => {
  let tempFilePath = null;

  try {
    let extractedText = '';
    let sourceDocumentName = 'Pasted Text';

    if (req.file) {
      tempFilePath = req.file.path;
      sourceDocumentName = req.file.originalname;
      try {
        const processed = await processUploadedFile(req.file.path, req.file.originalname);
        extractedText = processed.cleanedText || '';
      } catch (parseErr) {
        return res.status(422).json({
          success: false,
          message: `File parsing failed: ${parseErr.message}`
        });
      }
    } else if (req.body.pastedText) {
      const val = validatePastedText(req.body.pastedText);
      extractedText = val.cleanedText || '';
      sourceDocumentName = 'Pasted Content';
    } else {
      return res.status(400).json({
        success: false,
        message: 'Provide a file (PDF/TXT/DOCX/CSV) or paste text in "pastedText" field.'
      });
    }

    if (!extractedText || extractedText.trim().length < 50) {
      return res.status(400).json({
        success: false,
        message: 'Extracted text is too short (minimum 50 characters). Please provide more content.'
      });
    }

    const subject = (req.body.subject || 'General Studies').trim();
    const topic = (req.body.topic || 'General').trim();
    const exam = (req.body.exam || 'General').trim();
    const difficulty = req.body.difficulty || 'Medium';
    const questionCount = Math.max(parseInt(req.body.questionCount, 10) || 10, 1); // No upper cap — material density determines count
    const language = (req.body.language || 'en').trim(); // 'en' | 'hi' | 'bilingual'
    const mode = (req.body.mode || 'quick').trim(); // 'comprehensive' | 'quick'
    const skipGroq = req.body.skipGroq === 'true' || req.body.skipGroq === true;
    const skipVerification = req.body.skipVerification === 'true' || req.body.skipVerification === true;

    console.log(`[DocToTest] Starting pipeline: subject=${subject}, topic=${topic}, count=${questionCount}, mode=${mode}, language=${language}, user=${req.user?.name || 'unknown'}`);

    const { questions, stats } = await runDocToTestPipeline({
      extractedText,
      subject,
      topic,
      exam,
      difficulty,
      questionCount,
      language,
      mode,
      sourceDocumentName,
      createdBy: req.user?.name || 'Admin',
      skipGroq,
      skipVerification
    });

    if (!questions || questions.length === 0) {
      return res.status(422).json({
        success: false,
        message: 'No questions could be generated from this material. AI providers may be slow or rate-limited. Try with shorter material or enable Skip Verification.',
        stats
      });
    }

    return res.status(200).json({
      success: true,
      message: `Pipeline complete. Generated ${questions.length} questions ready for review.`,
      questions,
      stats,
      metadata: {
        sourceDocumentName,
        subject,
        topic,
        exam,
        difficulty,
        language,
        mode,
        requestedCount: questionCount,
        extractedChars: extractedText.length
      }
    });
  } catch (err) {
    console.error('[DocToTest] Pipeline error:', err.message);
    return res.status(500).json({
      success: false,
      message: err.message || 'Pipeline processing failed.'
    });
  } finally {
    cleanupFile(tempFilePath);
  }
});

// ─── POST /api/ai/doc-to-test/save ────────────────────────────────────────────

router.post('/save', authMiddleware, adminGuard, async (req, res) => {
  try {
    const { questions, status } = req.body;

    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No questions provided. Send a non-empty "questions" array.'
      });
    }

    if (questions.length > 200) {
      return res.status(400).json({
        success: false,
        message: 'Too many questions in one batch (max 200). Split into smaller batches.'
      });
    }

    const allowedStatus = ['PENDING_REVIEW', 'PUBLISHED'];
    const saveStatus = allowedStatus.includes(status) ? status : 'PENDING_REVIEW';

    const result = await validateAndSaveQuestions(questions, {
      createdBy: req.user?.name || 'Admin',
      status: saveStatus
    });

    return res.status(200).json({
      success: true,
      message: `Saved ${result.saved} questions to Question Bank. Skipped ${result.skipped} duplicates.`,
      saved: result.saved,
      skipped: result.skipped,
      errors: result.errors,
      savedStatus: saveStatus
    });
  } catch (err) {
    console.error('[DocToTest Save] Error:', err.message);
    return res.status(500).json({
      success: false,
      message: err.message || 'Save failed.'
    });
  }
});

export default router;
