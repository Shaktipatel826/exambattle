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

// 6. Bulk MCQ Parse + Save
// POST /api/questions/bulk-mcq
// Body: { text, subject, topic, difficulty }
// Parses plain-text MCQ blocks (Q1:/A./B./C./D./Answer:) and saves valid ones.
router.post('/bulk-mcq', authMiddleware, async (req, res) => {
  try {
    const { text, subject, topic, difficulty } = req.body;

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ success: false, message: 'MCQ text is required.' });
    }
    if (!subject) {
      return res.status(400).json({ success: false, message: 'Subject is required.' });
    }

    const isAdmin = req.user && req.user.role === 'ADMIN';

    // ── Parser ──────────────────────────────────────────────────────────────
    const valid = [];
    const invalid = [];

    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    let i = 0;

    while (i < lines.length) {
      const line = lines[i].trim();

      // Find question line: Q1: or Q1.
      const qMatch = line.match(/^Q\s*(\d+)\s*[:.][\s]*([\s\S]*)?/i);
      if (!qMatch) { i++; continue; }

      const qNum = parseInt(qMatch[1], 10);
      let questionText = (qMatch[2] || '').trim();
      i++;

      // Collect multi-line question text until A. / B. etc.
      while (i < lines.length) {
        const next = lines[i].trim();
        if (/^[A-Da-d]\s*[.)]\s+/i.test(next)) break;
        if (/^Q\s*\d+\s*[:.]/i.test(next)) break;
        if (/^(Answer|Ans|Correct\s*Answer)\s*:/i.test(next)) break;
        questionText += (next ? ' ' + next : '');
        i++;
      }
      questionText = questionText.trim();

      // Collect exactly 4 options A B C D
      const options = [];
      while (i < lines.length && options.length < 4) {
        const next = lines[i].trim();
        const optMatch = next.match(/^([A-Da-d])\s*[.)]\s+([\s\S]+)/i);
        if (!optMatch) break;
        options.push(optMatch[2].trim());
        i++;
      }

      // Parse answer line: Ans: A / Answer: B / Correct Answer: C
      let correctLetter = '';
      while (i < lines.length) {
        const next = lines[i].trim();
        if (/^(Answer|Ans|Correct\s*Answer)\s*:/i.test(next)) {
          const aMatch = next.match(/^(?:Answer|Ans|Correct\s*Answer)\s*:\s*([A-Da-d])/i);
          if (aMatch) correctLetter = aMatch[1].toUpperCase();
          i++;
          break;
        }
        // Stop if we hit next question or option
        if (/^Q\s*\d+\s*[:.]/i.test(next) || /^[A-Da-d]\s*[.)]\s+/i.test(next)) break;
        // skip blank or unrecognised line before answer
        i++;
      }

      // Parse optional explanation
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

      // Skip blank lines
      while (i < lines.length && lines[i].trim() === '') i++;

      // ── Validation ──────────────────────────────────────────────────
      const ref = `Q${qNum}`;

      if (!questionText) {
        invalid.push({ questionNumber: qNum, text: ref, reason: 'Question text is empty.' });
        continue;
      }
      if (options.length !== 4) {
        invalid.push({ questionNumber: qNum, text: questionText.substring(0, 60), reason: `Expected 4 options (A/B/C/D), found ${options.length}.` });
        continue;
      }
      if (!correctLetter || !['A', 'B', 'C', 'D'].includes(correctLetter)) {
        invalid.push({ questionNumber: qNum, text: questionText.substring(0, 60), reason: 'Missing or invalid answer (expected Ans: A/B/C/D).' });
        continue;
      }

      const correctIndex = correctLetter.charCodeAt(0) - 65; // A=0, B=1, C=2, D=3

      valid.push({
        question: questionText,
        options,
        correctAnswer: correctIndex,
        explanation,
        subject: subject || 'General Studies',
        topic: topic || subject || 'General',
        difficulty: (difficulty && difficulty !== 'Mixed') ? difficulty : 'Medium',
        language: 'en',
        source: 'Manual Entry',
        sourceType: isAdmin ? 'ADMIN_CREATED' : 'STUDENT_PERSONAL',
        verified: isAdmin,
        status: isAdmin ? 'PUBLISHED' : 'PENDING_REVIEW',
        createdBy: req.user.name || 'System',
        duplicateFlag: false,
      });
    }

    // ── Save valid questions ─────────────────────────────────────────────────
    let savedCount = 0;
    let saveErrors = [];

    if (valid.length > 0) {
      try {
        const inserted = await Question.insertMany(valid, { ordered: false });
        savedCount = inserted.length;
      } catch (bulkErr) {
        // insertMany with ordered:false returns partial results on duplicate key errors
        if (bulkErr.insertedDocs) {
          savedCount = bulkErr.insertedDocs.length;
        } else if (bulkErr.result && bulkErr.result.nInserted !== undefined) {
          savedCount = bulkErr.result.nInserted;
        } else {
          saveErrors.push(bulkErr.message);
        }
      }
    }

    return res.status(201).json({
      success: true,
      totalParsed: valid.length + invalid.length,
      valid: valid.length,
      invalid: invalid.length,
      saved: savedCount,
      errors: invalid,
      saveErrors
    });
  } catch (err) {
    console.error('[bulk-mcq] Unexpected error:', err);
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

