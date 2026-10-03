import express from 'express';
import { Question } from '../models/Question.js';
import { Report } from '../models/GamificationModels.js';
import { authMiddleware, adminGuard } from '../middleware/auth.js';

const router = express.Router();

// Helper: Normalize question text for duplicate detection
const normalizeText = (text = '') => {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
};

// 1. Search & Filter Questions (Strict Student Security: Non-admins can only read PUBLISHED questions)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { subject, topic, exam, difficulty, sourceType, status, verified, page = 1, limit = 20, search } = req.query;
    const query = {};

    // SECURITY ENFORCEMENT: Students can ONLY view PUBLISHED questions
    if (!req.user || req.user.role !== 'ADMIN') {
      query.status = 'PUBLISHED';
    } else if (status && status !== 'ALL') {
      query.status = status;
    }

    if (subject && subject !== 'All') query.subject = subject;
    if (topic && topic !== 'All') query.topic = topic;
    if (exam && exam !== 'All') query.exam = exam;
    if (difficulty && difficulty !== 'All') query.difficulty = difficulty;
    if (sourceType && sourceType !== 'All') query.sourceType = sourceType;
    if (verified !== undefined && verified !== '') query.verified = verified === 'true';
    if (search) {
      query.question = { $regex: search, $options: 'i' };
    }

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Math.min(100, Number(limit)));

    const total = await Question.countDocuments(query);
    const questions = await Question.find(query)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    return res.json({
      success: true,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum) || 1,
      questions
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// 2. Check for Duplicate Question
router.post('/duplicate-check', authMiddleware, async (req, res) => {
  try {
    const { question } = req.body;
    if (!question || typeof question !== 'string') {
      return res.status(400).json({ success: false, message: 'Question text required.' });
    }

    const norm = normalizeText(question);
    const allQuestions = await Question.find({}).select('question subject topic _id');
    const matches = allQuestions.filter(q => normalizeText(q.question) === norm || q.question.trim().toLowerCase() === question.trim().toLowerCase());

    return res.json({
      success: true,
      isDuplicate: matches.length > 0,
      matches: matches.map(m => ({ id: m._id, question: m.question, subject: m.subject, topic: m.topic }))
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// 3. Create Manual Question (Admin creates as PUBLISHED, Student creates as PENDING_REVIEW)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const {
      question,
      options,
      correctAnswer,
      explanation,
      subject,
      subSubject,
      topic,
      exam,
      examYear,
      examShift,
      difficulty,
      language,
      source,
      sourceType,
      tags
    } = req.body;

    if (!question || !options || !Array.isArray(options) || options.length !== 4 || correctAnswer === undefined) {
      return res.status(400).json({ success: false, message: 'Valid question, exactly 4 options, and correctAnswer index required.' });
    }

    // Check duplicate
    const norm = normalizeText(question);
    const existing = await Question.findOne({ question: question.trim() });
    const duplicateFlag = !!existing;

    const isAdmin = req.user.role === 'ADMIN';

    const newQuestion = await Question.create({
      question: question.trim(),
      options: options.map(o => o.trim()),
      correctAnswer: Number(correctAnswer),
      explanation: explanation || '',
      subject: subject || 'General Studies',
      subSubject: subSubject || '',
      topic: topic || 'General',
      exam: exam || 'General',
      examYear: examYear ? Number(examYear) : null,
      examShift: examShift || '',
      difficulty: difficulty || 'Medium',
      language: language || 'en',
      source: source || 'Manual Entry',
      sourceType: sourceType || (isAdmin ? 'ADMIN_CREATED' : 'STUDENT_PERSONAL'),
      tags: Array.isArray(tags) ? tags : [],
      verified: isAdmin,
      status: isAdmin ? 'PUBLISHED' : 'PENDING_REVIEW',
      createdBy: req.user.name || 'System',
      duplicateFlag
    });

    return res.status(201).json({ success: true, question: newQuestion, message: isAdmin ? 'Question published successfully!' : 'Question submitted for admin review.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// 4. Edit Question with Version History Audit Trail (Admin or Question Creator)
router.put('/:id', authMiddleware, adminGuard, async (req, res) => {
  try {
    const existingQuestion = await Question.findById(req.params.id);
    if (!existingQuestion) {
      return res.status(404).json({ success: false, message: 'Question not found.' });
    }

    // Push previous version into audit history before mutating
    existingQuestion.versionHistory.push({
      question: existingQuestion.question,
      options: existingQuestion.options,
      correctAnswer: existingQuestion.correctAnswer,
      explanation: existingQuestion.explanation,
      editedBy: req.user.name || 'Admin',
      editedAt: new Date()
    });

    const {
      question,
      options,
      correctAnswer,
      explanation,
      subject,
      subSubject,
      topic,
      exam,
      examYear,
      examShift,
      difficulty,
      tags,
      status,
      verified,
      sourceType
    } = req.body;

    if (question) existingQuestion.question = question.trim();
    if (options && Array.isArray(options) && options.length === 4) existingQuestion.options = options.map(o => o.trim());
    if (correctAnswer !== undefined) existingQuestion.correctAnswer = Number(correctAnswer);
    if (explanation !== undefined) existingQuestion.explanation = explanation;
    if (subject) existingQuestion.subject = subject;
    if (subSubject !== undefined) existingQuestion.subSubject = subSubject;
    if (topic) existingQuestion.topic = topic;
    if (exam) existingQuestion.exam = exam;
    if (examYear !== undefined) existingQuestion.examYear = examYear ? Number(examYear) : null;
    if (examShift !== undefined) existingQuestion.examShift = examShift;
    if (difficulty) existingQuestion.difficulty = difficulty;
    if (tags && Array.isArray(tags)) existingQuestion.tags = tags;
    if (status) existingQuestion.status = status;
    if (verified !== undefined) existingQuestion.verified = verified;
    if (sourceType) existingQuestion.sourceType = sourceType;

    await existingQuestion.save();

    return res.json({
      success: true,
      message: 'Question updated successfully with audit trail recorded.',
      question: existingQuestion
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// 5. Delete Question (Admin Only)
router.delete('/:id', authMiddleware, adminGuard, async (req, res) => {
  try {
    const question = await Question.findByIdAndDelete(req.params.id);
    if (!question) {
      return res.status(404).json({ success: false, message: 'Question not found.' });
    }
    return res.json({ success: true, message: 'Question deleted from question bank.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// 6. Report a Question
router.post('/:id/report', authMiddleware, async (req, res) => {
  try {
    const { reason, comments } = req.body;
    const report = await Report.create({
      questionId: req.params.id,
      userId: req.user.id,
      userName: req.user.name,
      reason: reason || 'TYPO',
      comments: comments || ''
    });
    return res.json({ success: true, message: 'Question report submitted to admins for review.', report });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

export default router;

