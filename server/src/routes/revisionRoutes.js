import express from 'express';
import { Mistake } from '../models/Mistake.js';
import { Question } from '../models/Question.js';
import { TestAttempt } from '../models/TestAttempt.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Get My Wrong Question Notebook categorized by subject
router.get('/notebook', authMiddleware, async (req, res) => {
  try {
    const mistakes = await Mistake.find({ userId: req.user.id, mastered: false })
      .sort({ updatedAt: -1 });

    const questionIds = mistakes.map(m => m.questionId);
    const questions = await Question.find({ _id: { $in: questionIds } });

    const questionMap = new Map();
    questions.forEach(q => questionMap.set(q._id.toString(), q));

    const categorized = {};
    mistakes.forEach(m => {
      const sub = m.subject || 'General';
      if (!categorized[sub]) categorized[sub] = [];
      const q = questionMap.get(m.questionId.toString());
      if (q) {
        categorized[sub].push({
          mistakeId: m._id,
          question: q,
          wrongCount: m.wrongCount,
          nextRevisionDate: m.nextRevisionDate
        });
      }
    });

    return res.json({ success: true, categorized, totalMistakes: mistakes.length });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// Get Due Smart Revision Items (Spaced Repetition)
router.get('/due-items', authMiddleware, async (req, res) => {
  try {
    const now = new Date();
    const dueMistakes = await Mistake.find({
      userId: req.user.id,
      mastered: false,
      nextRevisionDate: { $lte: now }
    }).limit(20);

    const questionIds = dueMistakes.map(m => m.questionId);
    const questions = await Question.find({ _id: { $in: questionIds } });

    return res.json({
      success: true,
      dueCount: dueMistakes.length,
      questions
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// Weak Topic Performance Breakdown
router.get('/weak-topics', authMiddleware, async (req, res) => {
  try {
    const attempts = await TestAttempt.find({ userId: req.user.id });

    const topicStats = {};
    attempts.forEach(a => {
      a.answers.forEach(ans => {
        const topicKey = `${a.subject || 'General'} - ${a.topic || 'General'}`;
        if (!topicStats[topicKey]) {
          topicStats[topicKey] = { total: 0, correct: 0, subject: a.subject, topic: a.topic };
        }
        topicStats[topicKey].total += 1;
        if (ans.isCorrect) topicStats[topicKey].correct += 1;
      });
    });

    const topicAnalysis = Object.keys(topicStats).map(key => {
      const stat = topicStats[key];
      const accuracy = stat.total > 0 ? Math.round((stat.correct / stat.total) * 100) : 0;
      return {
        key,
        subject: stat.subject,
        topic: stat.topic,
        total: stat.total,
        accuracy,
        status: accuracy >= 75 ? 'Strong' : accuracy >= 50 ? 'Moderate' : 'Weak'
      };
    });

    const weakTopics = topicAnalysis.filter(t => t.status === 'Weak');
    const strongTopics = topicAnalysis.filter(t => t.status === 'Strong');

    return res.json({
      success: true,
      weakTopics,
      strongTopics,
      allTopics: topicAnalysis
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
