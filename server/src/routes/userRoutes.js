import express from 'express';
import { User } from '../models/User.js';
import { TestAttempt } from '../models/TestAttempt.js';
import { Mistake } from '../models/Mistake.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Get Student Dashboard Metrics
router.get('/dashboard', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    const recentAttempts = await TestAttempt.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(5);

    const totalMistakesCount = await Mistake.countDocuments({ userId: req.user.id, mastered: false });
    const pendingRevisionCount = await Mistake.countDocuments({
      userId: req.user.id,
      mastered: false,
      nextRevisionDate: { $lte: new Date() }
    });

    // Subject performance metrics calculation
    const attempts = await TestAttempt.find({ userId: req.user.id });
    const subjectStats = {};
    attempts.forEach(a => {
      const sub = a.subject || 'General Studies';
      if (!subjectStats[sub]) {
        subjectStats[sub] = { total: 0, correct: 0 };
      }
      subjectStats[sub].total += a.totalQuestions || 0;
      subjectStats[sub].correct += a.correctCount || 0;
    });

    const subjectBreakdown = Object.keys(subjectStats).map(s => ({
      subject: s,
      accuracy: subjectStats[s].total > 0 ? Math.round((subjectStats[s].correct / subjectStats[s].total) * 100) : 0
    }));

    return res.json({
      success: true,
      user,
      recentAttempts,
      totalMistakesCount,
      pendingRevisionCount,
      subjectBreakdown,
      dailyMissions: [
        { id: 'm1', title: '10 GK Questions', completed: false, xpReward: 20 },
        { id: 'm2', title: '10 Polity Questions', completed: false, xpReward: 20 },
        { id: 'm3', title: 'Revise 5 Mistakes', completed: false, xpReward: 25 },
        { id: 'm4', title: 'Complete 1 Battle', completed: false, xpReward: 30 }
      ]
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// Update Target Exams
router.put('/target-exams', authMiddleware, async (req, res) => {
  try {
    const { targetExams } = req.body;
    const user = await User.findById(req.user.id);
    user.targetExams = targetExams;
    await user.save();
    return res.json({ success: true, targetExams: user.targetExams });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// Global Leaderboards (XP, Weekly, Subject)
router.get('/leaderboard', authMiddleware, async (req, res) => {
  try {
    const topUsers = await User.find()
      .select('name email xp level avatar targetExams')
      .sort({ xp: -1 })
      .limit(20);

    const formattedLeaderboard = topUsers.map((u, index) => ({
      rank: index + 1,
      id: u._id,
      name: u.name,
      xp: u.xp || 0,
      level: u.level || 1,
      targetExam: (u.targetExams && u.targetExams[0]) ? u.targetExams[0] : 'SSC CGL'
    }));

    return res.json({ success: true, leaderboard: formattedLeaderboard });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
