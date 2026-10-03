import express from 'express';
import { User } from '../models/User.js';
import { TestAttempt } from '../models/TestAttempt.js';
import { Question } from '../models/Question.js';
import { Mistake } from '../models/Mistake.js';
import { DailyChallenge, DailyChallengeAttempt } from '../models/GamificationSystem.js';
import { authMiddleware } from '../middleware/auth.js';
import { 
  calculateLevelFromXP, 
  awardUserXP, 
  awardUserCoins, 
  updateQualifyingStreak, 
  checkAndUnlockBadges,
  XP_CONFIG,
  COIN_CONFIG
} from '../services/gamification.js';

const router = express.Router();

// 1. Get Game-Like Student Dashboard Data
router.get('/dashboard', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'Student profile not found.' });

    const attempts = await TestAttempt.find({ userId: req.user.id });
    const mistakes = await Mistake.find({ userId: req.user.id });

    // Calculate aggregated stats
    const totalQuestions = attempts.reduce((acc, a) => acc + (a.totalQuestions || 0), 0);
    const totalCorrect = attempts.reduce((acc, a) => acc + (a.correctCount || 0), 0);
    const accuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
    const testsCompleted = attempts.length;
    const battlesCompleted = attempts.filter(a => a.testType === 'BATTLE').length;
    const battlesWon = attempts.filter(a => a.testType === 'BATTLE' && a.accuracy >= 70).length;
    const mistakesRemaining = mistakes.filter(m => !m.mastered).length;
    const masteredCount = mistakes.filter(m => m.mastered).length;

    // Check & unlock badges
    const unlocked = await checkAndUnlockBadges(req.user.id, {
      testAttemptsCount: testsCompleted,
      totalCorrect,
      revisionsCompleted: masteredCount,
      battlesCompleted,
      battlesWon,
      masteredCount
    });

    const levelInfo = calculateLevelFromXP(user.xp);

    // Subject Breakdown
    const subjectStatsMap = {};
    attempts.forEach(a => {
      const sub = a.subject || 'General Studies';
      if (!subjectStatsMap[sub]) subjectStatsMap[sub] = { total: 0, correct: 0 };
      subjectStatsMap[sub].total += a.totalQuestions || 0;
      subjectStatsMap[sub].correct += a.correctCount || 0;
    });

    const subjectProgress = Object.keys(subjectStatsMap).map(sub => ({
      subject: sub,
      accuracy: subjectStatsMap[sub].total > 0 ? Math.round((subjectStatsMap[sub].correct / subjectStatsMap[sub].total) * 100) : 0,
      totalQuestions: subjectStatsMap[sub].total
    }));

    const todayStr = new Date().toISOString().split('T')[0];
    const dailyAttempt = await DailyChallengeAttempt.findOne({ userId: req.user.id, dateStr: todayStr });

    return res.json({
      success: true,
      dashboard: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
          level: levelInfo.level,
          xp: user.xp,
          coins: user.coins || 0,
          streak: user.streak || 1,
          longestStreak: user.longestStreak || 1,
          levelInfo,
          unlockedBadges: user.unlockedBadges || []
        },
        stats: {
          totalQuestions,
          totalCorrect,
          accuracy,
          testsCompleted,
          battlesCompleted,
          battlesWon,
          mistakesRemaining,
          masteredCount
        },
        subjectProgress,
        dailyChallengeCompleted: !!dailyAttempt
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// 2. Get Revision Dashboard (Due Today, Overdue, Mastered)
router.get('/revision', authMiddleware, async (req, res) => {
  try {
    const now = new Date();
    const mistakes = await Mistake.find({ userId: req.user.id }).lean();

    const dueToday = [];
    const overdue = [];
    const mastered = [];

    mistakes.forEach(m => {
      if (m.mastered) {
        mastered.push(m);
      } else if (new Date(m.nextRevisionDate) <= now) {
        const diffHours = (now - new Date(m.nextRevisionDate)) / (1000 * 60 * 60);
        if (diffHours > 24) overdue.push(m);
        else dueToday.push(m);
      }
    });

    // Populate question details for due/overdue
    const allDueIds = [...dueToday, ...overdue].map(m => m.questionId);
    const dbQuestions = await Question.find({ _id: { $in: allDueIds } }).lean();
    const qMap = new Map(dbQuestions.map(q => [q._id.toString(), q]));

    const dueQuestions = [...dueToday, ...overdue].map(m => {
      const q = qMap.get(m.questionId);
      return {
        mistakeId: m._id,
        questionId: m.questionId,
        question: q ? q.question : 'Question content',
        options: q ? q.options : [],
        correctAnswer: q ? q.correctAnswer : 0,
        explanation: q ? q.explanation : '',
        subject: m.subject,
        topic: m.topic,
        wrongCount: m.wrongCount,
        correctStreak: m.correctStreak,
        intervalDays: m.intervalDays,
        nextRevisionDate: m.nextRevisionDate
      };
    });

    return res.json({
      success: true,
      revisionSummary: {
        dueTodayCount: dueToday.length,
        overdueCount: overdue.length,
        masteredCount: mastered.length,
        totalMistakesCount: mistakes.length,
        dueQuestions
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// 3. Get Mistake Book
router.get('/mistakes', authMiddleware, async (req, res) => {
  try {
    const { subject, topic, difficulty, mastered } = req.query;
    const query = { userId: req.user.id };

    if (subject && subject !== 'All') query.subject = subject;
    if (topic && topic !== 'All') query.topic = topic;
    if (mastered !== undefined) query.mastered = mastered === 'true';

    const mistakes = await Mistake.find(query).sort({ lastAttemptedDate: -1 }).lean();
    const qIds = mistakes.map(m => m.questionId);
    const dbQuestions = await Question.find({ _id: { $in: qIds } }).lean();
    const qMap = new Map(dbQuestions.map(q => [q._id.toString(), q]));

    const mistakeBook = mistakes.map(m => {
      const q = qMap.get(m.questionId);
      return {
        mistakeId: m._id,
        questionId: m.questionId,
        question: q ? q.question : 'Question text unavailable',
        options: q ? q.options : [],
        correctAnswer: q ? q.correctAnswer : 0,
        explanation: q ? q.explanation : '',
        subject: m.subject,
        topic: m.topic,
        difficulty: q ? q.difficulty : 'Medium',
        wrongCount: m.wrongCount,
        correctStreak: m.correctStreak,
        intervalDays: m.intervalDays,
        mastered: m.mastered,
        lastAttemptedDate: m.lastAttemptedDate
      };
    });

    return res.json({ success: true, mistakeBook });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// 4. Analyze Weak Topics & Performance (Min sample size guard: < 5 attempts = "Not enough data")
router.get('/weak-topics', authMiddleware, async (req, res) => {
  try {
    const attempts = await TestAttempt.find({ userId: req.user.id }).lean();
    const topicMap = {};

    attempts.forEach(a => {
      a.answers?.forEach(ans => {
        const topicKey = `${a.subject}:::${a.topic}`;
        if (!topicMap[topicKey]) {
          topicMap[topicKey] = { subject: a.subject, topic: a.topic, total: 0, correct: 0 };
        }
        topicMap[topicKey].total += 1;
        if (ans.isCorrect) topicMap[topicKey].correct += 1;
      });
    });

    const topicAnalysis = Object.values(topicMap).map(t => {
      const sampleSize = t.total;
      if (sampleSize < 5) {
        return {
          subject: t.subject,
          topic: t.topic,
          totalAttempts: sampleSize,
          accuracy: sampleSize > 0 ? Math.round((t.correct / sampleSize) * 100) : 0,
          statusCategory: 'Not enough data'
        };
      }

      const acc = Math.round((t.correct / sampleSize) * 100);
      let statusCategory = 'Needs Practice';
      if (acc >= 75) statusCategory = 'Strong';
      else if (acc < 50) statusCategory = 'Weak';

      return {
        subject: t.subject,
        topic: t.topic,
        totalAttempts: sampleSize,
        accuracy: acc,
        statusCategory
      };
    });

    return res.json({ success: true, topicAnalysis });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// 5. Get Deterministic "Today's Study Plan"
router.get('/today-plan', authMiddleware, async (req, res) => {
  try {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    const dueMistakes = await Mistake.countDocuments({ userId: req.user.id, nextRevisionDate: { $lte: now }, mastered: false });
    const dailyDone = await DailyChallengeAttempt.exists({ userId: req.user.id, dateStr: todayStr });
    
    // Find weakest topic
    const attempts = await TestAttempt.find({ userId: req.user.id }).lean();
    const topicMap = {};
    attempts.forEach(a => {
      a.answers?.forEach(ans => {
        const topicKey = `${a.subject}:::${a.topic}`;
        if (!topicMap[topicKey]) topicMap[topicKey] = { subject: a.subject, topic: a.topic, total: 0, correct: 0 };
        topicMap[topicKey].total += 1;
        if (ans.isCorrect) topicMap[topicKey].correct += 1;
      });
    });

    const weakList = Object.values(topicMap)
      .filter(t => t.total >= 3)
      .map(t => ({ subject: t.subject, topic: t.topic, accuracy: Math.round((t.correct / t.total) * 100) }))
      .sort((a, b) => a.accuracy - b.accuracy);

    const weakestTopic = weakList[0] || { subject: 'Indian Polity', topic: 'Fundamental Rights' };

    const planTasks = [
      {
        id: 1,
        title: dueMistakes > 0 ? `Revise ${dueMistakes} Overdue Questions` : 'Review Spaced Revision Notebook',
        category: 'REVISION',
        isCompleted: dueMistakes === 0,
        detail: dueMistakes > 0 ? `${dueMistakes} questions due in your revision queue.` : 'Revision queue clear for today!'
      },
      {
        id: 2,
        title: `Practice Weak Topic: ${weakestTopic.subject} (${weakestTopic.topic})`,
        category: 'WEAK_TOPIC',
        isCompleted: false,
        detail: `Targeted practice for ${weakestTopic.topic}.`
      },
      {
        id: 3,
        title: 'Complete 10-Question Daily Challenge',
        category: 'DAILY_CHALLENGE',
        isCompleted: !!dailyDone,
        detail: dailyDone ? 'Daily challenge completed for today (+50 XP).' : 'Daily challenge ready!'
      }
    ];

    return res.json({ success: true, todayPlan: planTasks });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// 6. Get Daily Challenge Paper
router.get('/daily-challenge', authMiddleware, async (req, res) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    let challenge = await DailyChallenge.findOne({ dateStr: todayStr });

    if (!challenge) {
      const publishedQs = await Question.find({ status: 'PUBLISHED' }).limit(10).lean();
      if (!publishedQs || publishedQs.length === 0) {
        return res.status(404).json({ success: false, message: 'No published questions available for daily challenge.' });
      }
      challenge = await DailyChallenge.create({
        dateStr: todayStr,
        questionIds: publishedQs.map(q => q._id.toString()),
        totalQuestions: publishedQs.length,
        rewardXp: 50,
        rewardCoins: 25
      });
    }

    const dbQuestions = await Question.find({ _id: { $in: challenge.questionIds }, status: 'PUBLISHED' }).lean();
    const alreadyAttempted = await DailyChallengeAttempt.exists({ userId: req.user.id, dateStr: todayStr });

    return res.json({
      success: true,
      dailyChallenge: {
        dateStr: challenge.dateStr,
        totalQuestions: challenge.totalQuestions,
        rewardXp: challenge.rewardXp,
        rewardCoins: challenge.rewardCoins,
        alreadyAttempted: !!alreadyAttempted,
        // SECURITY: Strip answer keys
        questions: dbQuestions.map(q => ({
          _id: q._id.toString(),
          question: q.question,
          options: q.options,
          subject: q.subject,
          topic: q.topic,
          difficulty: q.difficulty
        }))
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// 7. Submit Daily Challenge Paper (Server-side scoring + single reward claim constraint)
router.post('/daily-challenge/submit', authMiddleware, async (req, res) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const existing = await DailyChallengeAttempt.findOne({ userId: req.user.id, dateStr: todayStr });

    if (existing) {
      return res.status(400).json({ success: false, message: 'Daily Challenge reward already claimed for today!' });
    }

    const { answers } = req.body;
    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({ success: false, message: 'Answers payload required.' });
    }

    const qIds = answers.map(a => a.questionId);
    const dbQs = await Question.find({ _id: { $in: qIds }, status: 'PUBLISHED' }).lean();
    const qMap = new Map(dbQs.map(q => [q._id.toString(), q]));

    let correctCount = 0;
    let wrongCount = 0;
    for (const a of answers) {
      const dbQ = qMap.get(a.questionId);
      if (dbQ && a.selectedOption !== undefined && Number(a.selectedOption) === dbQ.correctAnswer) {
        correctCount++;
      } else {
        wrongCount++;
      }
    }

    const total = answers.length;
    const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 0;
    const score = correctCount;

    await DailyChallengeAttempt.create({
      userId: req.user.id,
      dateStr: todayStr,
      score,
      accuracy
    });

    // Update Streak & Award Server-Side Rewards
    const newStreak = await updateQualifyingStreak(req.user.id);
    const xpResult = await awardUserXP(req.user.id, XP_CONFIG.DAILY_CHALLENGE, 'DAILY_CHALLENGE', 'DAILY_CHALLENGE', todayStr);
    const newCoins = await awardUserCoins(req.user.id, COIN_CONFIG.DAILY_CHALLENGE, 'DAILY_CHALLENGE', todayStr);

    return res.json({
      success: true,
      message: `Daily Challenge completed! Earned +${XP_CONFIG.DAILY_CHALLENGE} XP and +${COIN_CONFIG.DAILY_CHALLENGE} Coins!`,
      result: {
        score,
        total,
        accuracy,
        streak: newStreak,
        xpEarned: XP_CONFIG.DAILY_CHALLENGE,
        coinsEarned: COIN_CONFIG.DAILY_CHALLENGE,
        newCoins
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// 8. Get Safe Public Leaderboard (Privacy: Email NEVER exposed)
router.get('/leaderboard', authMiddleware, async (req, res) => {
  try {
    const { category = 'allTime' } = req.query;
    
    // Privacy Scoped Projection: NO email or sensitive data
    const users = await User.find({ role: 'STUDENT' })
      .select('name avatar level xp coins streak')
      .sort({ xp: -1 })
      .limit(20)
      .lean();

    const leaderboard = users.map((u, rank) => ({
      rank: rank + 1,
      userId: u._id.toString(),
      displayName: u.name,
      avatar: u.avatar || '',
      level: u.level || 1,
      xp: u.xp || 0,
      coins: u.coins || 0,
      streak: u.streak || 1
    }));

    return res.json({ success: true, category, leaderboard });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// 9. Get Achievements / Badges List
router.get('/achievements', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('unlockedBadges');
    const allBadges = [
      { code: 'FIRST_TEST', title: 'First Practice Step', description: 'Complete your first practice test paper.', icon: 'Target', rewardXp: 30 },
      { code: 'STREAK_3', title: '3-Day Learning Streak', description: 'Maintain a 3-day consecutive learning streak.', icon: 'Flame', rewardXp: 40 },
      { code: 'STREAK_7', title: '7-Day Master Streak', description: 'Maintain a 7-day consecutive learning streak.', icon: 'Zap', rewardXp: 70 },
      { code: 'QUESTIONS_100', title: 'Centurion Scholar', description: 'Answer 100 questions correctly.', icon: 'CheckCircle2', rewardXp: 100 },
      { code: 'QUESTIONS_500', title: '500 Practice Titan', description: 'Answer 500 questions correctly.', icon: 'Award', rewardXp: 250 },
      { code: 'REVISION_FIRST', title: 'First Revision Completed', description: 'Master your first spaced-revision mistake.', icon: 'RotateCcw', rewardXp: 40 },
      { code: 'BATTLE_FIRST', title: 'First Multiplayer Battle', description: 'Participate in your first live battle.', icon: 'Swords', rewardXp: 50 },
      { code: 'BATTLE_WINNER', title: 'Battle Champion', description: 'Win first place in a live multiplayer battle.', icon: 'Crown', rewardXp: 100 }
    ];

    const unlocked = user.unlockedBadges || [];
    const achievements = allBadges.map(b => ({
      ...b,
      unlocked: unlocked.includes(b.code)
    }));

    return res.json({ success: true, achievements });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
