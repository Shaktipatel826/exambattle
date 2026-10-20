/**
 * Saved Test API Routes
 * All routes require authentication. Ownership enforced on single-resource routes.
 *
 * GET    /api/saved-tests          — list my saved tests
 * POST   /api/saved-tests          — create new saved test
 * GET    /api/saved-tests/:id      — get one saved test (owner only)
 * DELETE /api/saved-tests/:id      — delete (owner only)
 */
import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { SavedTest } from '../models/SavedTest.js';

const router = express.Router();

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
