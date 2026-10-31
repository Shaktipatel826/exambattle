/**
 * Saved Test API Routes
 * All routes require authentication. Ownership enforced on single-resource routes.
 *
 * GET    /api/saved-tests              — list my saved tests
 * POST   /api/saved-tests/parse-text  — parse raw Q&A text → return questions array (no DB write)
 * POST   /api/saved-tests             — create new saved test
 * GET    /api/saved-tests/:id         — get one saved test (owner only)
 * DELETE /api/saved-tests/:id         — delete (owner only)
 */
import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { SavedTest } from '../models/SavedTest.js';

const router = express.Router();

// ─── Q&A Text Parser ──────────────────────────────────────────────────────────
/**
 * Parse raw direct Q&A text in the format:
 *
 *   Q1: Question text here
 *   Answer: Reference answer here
 *   Explanation: Optional explanation (omittable)
 *
 *   Q2: अगला सवाल यहाँ
 *   Answer: जवाब यहाँ
 *
 * - No MCQ options (A/B/C/D) involved.
 * - Supports Hindi, English, Hinglish.
 * - Supports multi-line questions and multi-line answers.
 * - Returns { questions, errors, stats }.
 * - Does NOT save anything to the database.
 */
function parseQAText(rawText) {
  const questions = [];
  const errors = [];
  const seenQuestions = new Set(); // lowercase-trimmed, for duplicate detection

  // Normalize line endings
  const lines = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    // Look for a question line: Q<number>: or Q<number>.
    // Accepts: Q1: Q2. Q10: q1: (case-insensitive)
    const qMatch = line.match(/^Q\s*(\d+)\s*[:.]\s*(.+)?/i);
    if (!qMatch) {
      i++;
      continue;
    }

    const qNum = parseInt(qMatch[1], 10);
    let questionText = (qMatch[2] || '').trim();
    i++;

    // Collect continuation lines of the question until Answer:/Q<n>:
    while (i < lines.length) {
      const nextLine = lines[i].trim();
      if (/^(Answer|Ans)\s*:/i.test(nextLine)) break;
      if (/^Q\s*\d+\s*[:.]/i.test(nextLine)) break;
      if (/^Explanation\s*:/i.test(nextLine)) break;
      // Blank line is allowed within multi-line question but two blanks in a row = stop
      questionText += (nextLine ? ' ' + nextLine : '');
      i++;
    }
    questionText = questionText.trim();

    // Parse Answer: line
    let referenceAnswer = '';
    if (i < lines.length && /^(Answer|Ans)\s*:/i.test(lines[i].trim())) {
      const ansMatch = lines[i].trim().match(/^(Answer|Ans)\s*:\s*(.*)/i);
      referenceAnswer = (ansMatch?.[2] || '').trim();
      i++;
      // Collect multi-line answer
      while (i < lines.length) {
        const al = lines[i].trim();
        if (/^(Explanation|Q\s*\d+\s*[:.:])/i.test(al)) break;
        if (/^Q\s*\d+\s*[:.]/i.test(al)) break;
        if (al === '') { i++; break; } // blank line ends answer
        referenceAnswer += ' ' + al;
        i++;
      }
      referenceAnswer = referenceAnswer.trim();
    }

    // Parse optional Explanation:
    let explanation = '';
    if (i < lines.length && /^Explanation\s*:/i.test(lines[i].trim())) {
      const expMatch = lines[i].trim().match(/^Explanation\s*:\s*(.*)/i);
      explanation = (expMatch?.[1] || '').trim();
      i++;
      while (i < lines.length) {
        const el = lines[i].trim();
        if (/^Q\s*\d+\s*[:.]/i.test(el)) break;
        if (el === '') { i++; break; }
        explanation += ' ' + el;
        i++;
      }
      explanation = explanation.trim();
    }

    // Skip blank lines between entries
    while (i < lines.length && lines[i].trim() === '') i++;

    // ── Validation ──────────────────────────────────────────────────
    const ref = `Q${qNum}`;

    if (!questionText) {
      errors.push({ ref, issue: 'Question text is empty.' });
      continue;
    }
    if (!referenceAnswer) {
      errors.push({ ref, issue: 'Missing "Answer:" line. Every question must have an answer.' });
      continue;
    }

    // Duplicate detection (case-insensitive, whitespace-normalised)
    const qKey = questionText.toLowerCase().replace(/\s+/g, ' ').trim();
    if (seenQuestions.has(qKey)) {
      errors.push({ ref, issue: 'Duplicate question — already seen earlier in the same input.' });
      continue;
    }
    seenQuestions.add(qKey);

    questions.push({
      question: questionText,
      referenceAnswer,
      explanation: explanation || '',
      questionType: 'short_answer',
      // Keep options/correctAnswer null so existing MCQ code is unaffected
      options: [],
      correctAnswer: null,
    });
  }

  return {
    questions,
    errors,
    stats: {
      parsed: questions.length,
      errored: errors.length,
      total: questions.length + errors.length,
    },
  };
}

// POST /api/saved-tests/parse-text — parse Q&A text, return questions for preview (no DB write)
// IMPORTANT: This route MUST be registered before /:id to avoid path conflicts.
router.post('/parse-text', authMiddleware, (req, res) => {
  try {
    const { rawText } = req.body;
    if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
      return res.status(400).json({ success: false, message: 'rawText is required.' });
    }
    if (rawText.length > 500000) {
      return res.status(400).json({ success: false, message: 'Input too large (max 500 000 characters).' });
    }

    const result = parseQAText(rawText);

    if (result.questions.length === 0) {
      return res.status(422).json({
        success: false,
        message: 'No valid questions could be parsed. Check that your text follows the required format (Q1. ... A) ... Correct: ...).',
        errors: result.errors,
        stats: result.stats,
      });
    }

    return res.json({
      success: true,
      questions: result.questions,
      errors: result.errors,
      stats: result.stats,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/saved-tests — list my tests
router.get('/', authMiddleware, async (req, res) => {
  try {
    const tests = await SavedTest.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .select('-questions')  // omit question details from list view
      .lean();
    return res.json({ success: true, tests });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/saved-tests — save a new test
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { title, subject, topic, difficulty, language, mode, questions, stats, sourceDocumentName, extractedChars } = req.body;

    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ success: false, message: 'questions array is required and must be non-empty.' });
    }
    if (questions.length > 300) {
      return res.status(400).json({ success: false, message: 'Too many questions (max 300 per test).' });
    }

    const autoTitle = title?.trim() || `${subject || 'General'} Test — ${new Date().toLocaleDateString('en-IN')}`;

    const savedTest = await SavedTest.create({
      title: autoTitle,
      userId: req.user.id,
      userName: req.user.name,
      subject: subject || 'General Studies',
      topic: topic || 'General',
      difficulty: difficulty || 'Mixed',
      language: language || 'en',
      mode: mode || 'quick',
      questionCount: questions.length,
      questions,
      stats: stats || {},
      sourceDocumentName: sourceDocumentName || 'Unknown Source',
      extractedChars: extractedChars || 0
    });

    return res.status(201).json({ success: true, savedTest: { ...savedTest.toObject(), questions: undefined, questionCount: savedTest.questionCount } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/saved-tests/:id — get full test (owner only)
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const test = await SavedTest.findById(req.params.id).lean();
    if (!test) return res.status(404).json({ success: false, message: 'Test not found.' });
    if (test.userId !== req.user.id) return res.status(403).json({ success: false, message: 'Access denied.' });
    return res.json({ success: true, test });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/saved-tests/:id — delete (owner only)
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const test = await SavedTest.findById(req.params.id);
    if (!test) return res.status(404).json({ success: false, message: 'Test not found.' });
    if (test.userId !== req.user.id) return res.status(403).json({ success: false, message: 'Access denied.' });
    await test.deleteOne();
    return res.json({ success: true, message: 'Test deleted.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
