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
 * Parse raw Q&A text in the format:
 *
 *   Q1. Question text?
 *   A) Option A
 *   B) Option B
 *   C) Option C
 *   D) Option D
 *   Correct: B
 *   Explanation: Optional explanation text.
 *
 * Returns { success, questions, errors, stats }
 * Does NOT save anything to the database.
 */
function parseQAText(rawText) {
  const questions = [];
  const errors = [];

  // Normalize line endings and split into non-empty lines
  const lines = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  let i = 0;
  let questionIndex = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    // Look for a question line: starts with Q<number>. or Q<number>)
    const qMatch = line.match(/^Q\s*(\d+)[.)]\s+(.+)/i);
    if (!qMatch) {
      i++;
      continue;
    }

    questionIndex++;
    const qNum = parseInt(qMatch[1], 10);
    let questionText = qMatch[2].trim();
    i++;

    // Collect continuation lines of the question (until we hit an option line)
    while (i < lines.length) {
      const nextLine = lines[i].trim();
      if (/^[ABCD][.)]\s/i.test(nextLine)) break;
      if (/^(Correct|Answer)\s*:/i.test(nextLine)) break;
      if (/^Q\s*\d+[.)]/i.test(nextLine)) break;
      if (nextLine !== '') questionText += ' ' + nextLine;
      i++;
    }

    // Parse options A) B) C) D)
    const options = [];
    const optionLetters = ['A', 'B', 'C', 'D'];
    for (const letter of optionLetters) {
      if (i >= lines.length) break;
      const optLine = lines[i].trim();
      const optMatch = optLine.match(new RegExp(`^${letter}[.)]\\s+(.+)`, 'i'));
      if (optMatch) {
        options.push(optMatch[1].trim());
        i++;
        // Collect continuation lines of this option
        while (i < lines.length) {
          const cont = lines[i].trim();
          if (/^[ABCD][.)]\s/i.test(cont)) break;
          if (/^(Correct|Answer)\s*:/i.test(cont)) break;
          if (/^Q\s*\d+[.)]/i.test(cont)) break;
          if (cont !== '') options[options.length - 1] += ' ' + cont;
          i++;
        }
      }
    }

    // Parse Correct: line
    let correctAnswer = null;
    let explanation = '';

    while (i < lines.length) {
      const cl = lines[i].trim();
      if (/^Q\s*\d+[.)]/i.test(cl)) break;

      const correctMatch = cl.match(/^(Correct|Answer)\s*:\s*([ABCD])/i);
      if (correctMatch) {
        const letter = correctMatch[2].toUpperCase();
        correctAnswer = optionLetters.indexOf(letter); // 0-3
        i++;
        continue;
      }

      const explanationMatch = cl.match(/^Explanation\s*:\s*(.+)/i);
      if (explanationMatch) {
        explanation = explanationMatch[1].trim();
        i++;
        // Collect multi-line explanation
        while (i < lines.length) {
          const el = lines[i].trim();
          if (/^Q\s*\d+[.)]/i.test(el)) break;
          if (/^(Correct|Answer)\s*:/i.test(el)) break;
          if (el !== '') explanation += ' ' + el;
          else break; // blank line ends explanation
          i++;
        }
        continue;
      }

      // Blank line — skip
      if (cl === '') { i++; continue; }

      // Unknown content before next Q — stop
      break;
    }

    // Validate the parsed question
    const lineRef = `Q${qNum}`;
    if (!questionText) {
      errors.push({ ref: lineRef, issue: 'Question text is empty.' });
      continue;
    }
    if (options.length < 4) {
      errors.push({ ref: lineRef, issue: `Only ${options.length} options found — need exactly 4 (A, B, C, D).` });
      continue;
    }
    if (correctAnswer === null || correctAnswer < 0) {
      errors.push({ ref: lineRef, issue: 'Missing or invalid "Correct: <letter>" line.' });
      continue;
    }

    questions.push({
      question: questionText,
      options: options.slice(0, 4),
      correctAnswer,
      explanation: explanation || '',
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
