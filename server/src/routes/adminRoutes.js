import express from 'express';
import { Question } from '../models/Question.js';
import { User } from '../models/User.js';
import { Report } from '../models/GamificationModels.js';
import { authMiddleware, adminGuard } from '../middleware/auth.js';
import { generateSimilarQuestions } from '../services/gemini.js';

const router = express.Router();

// Get Admin Summary Dashboard Statistics
router.get('/stats', authMiddleware, adminGuard, async (req, res) => {
  try {
    const totalQuestions = await Question.countDocuments();
    const verifiedQuestions = await Question.countDocuments({ verified: true });
    const pendingReviews = await Question.countDocuments({ status: 'PENDING_REVIEW' });
    const aiQuestions = await Question.countDocuments({ sourceType: 'AI_GENERATED' });
    const pyqQuestions = await Question.countDocuments({ sourceType: 'VERIFIED_PYQ' });
    const duplicates = await Question.countDocuments({ duplicateFlag: true });
    const totalUsers = await User.countDocuments();
    const totalReports = await Report.countDocuments({ status: 'PENDING' });

    // Question distribution by subject
    const subjectStats = await Question.aggregate([
      { $group: { _id: '$subject', count: { $sum: 1 } } }
    ]);

    return res.json({
      success: true,
      stats: {
        totalQuestions,
        verifiedQuestions,
        pendingReviews,
        aiQuestions,
        pyqQuestions,
        duplicates,
        totalUsers,
        totalReports,
        subjectStats: subjectStats.map(s => ({ subject: s._id || 'Unassigned', count: s.count }))
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// Approve or Reject Question
router.put('/questions/:id/status', authMiddleware, adminGuard, async (req, res) => {
  try {
    const { status, verified } = req.body;
    const question = await Question.findById(req.params.id);
    if (!question) {
      return res.status(404).json({ success: false, message: 'Question not found.' });
    }

    question.status = status || question.status;
    if (verified !== undefined) question.verified = verified;
    await question.save();

    return res.json({ success: true, message: 'Question status updated successfully.', question });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// AI Question Generator for Admin Panel
router.post('/ai-generate', authMiddleware, adminGuard, async (req, res) => {
  try {
    const { subject, topic, difficulty, count = 5 } = req.body;
    const generated = await generateSimilarQuestions(
      `Core exam concepts for ${topic}`,
      subject || 'History',
      topic || 'Revolt of 1857',
      Number(count)
    );

    const pendingQuestions = [];
    for (const q of generated) {
      const newQ = await Question.create({
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        subject: subject || 'History',
        topic: topic || 'Revolt of 1857',
        difficulty: difficulty || 'Hard',
        sourceType: 'AI_GENERATED',
        verified: false,
        status: 'PENDING_REVIEW',
        createdBy: 'AI Generator (Admin)'
      });
      pendingQuestions.push(newQ);
    }

    return res.json({
      success: true,
      message: `Generated ${pendingQuestions.length} questions queued for pending review.`,
      questions: pendingQuestions
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// User Management List
router.get('/users', authMiddleware, adminGuard, async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    return res.json({ success: true, users });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// Question Reports Queue
router.get('/reports', authMiddleware, adminGuard, async (req, res) => {
  try {
    const reports = await Report.find().sort({ createdAt: -1 });
    return res.json({ success: true, reports });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
