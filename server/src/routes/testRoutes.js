import express from 'express';
import { Question } from '../models/Question.js';
import { TestAttempt } from '../models/TestAttempt.js';
import { Exam } from '../models/Exam.js';
import { authMiddleware } from '../middleware/auth.js';
import { awardUserXP } from '../services/gamification.js';
import { recordQuestionAttemptForRevision } from '../services/spacedRevision.js';

const router = express.Router();

// 1. Get Dynamic Test Configuration Options (Subjects, Topics, Exams from Database)
router.get('/config-options', authMiddleware, async (req, res) => {
  try {
    const subjects = await Question.distinct('subject', { status: 'PUBLISHED' });
    const topics = await Question.distinct('topic', { status: 'PUBLISHED' });
    const exams = await Question.distinct('exam', { status: 'PUBLISHED' });
    const difficulties = ['Easy', 'Medium', 'Hard'];
    const dbExams = await Exam.find({ active: true }).select('name category timeLimitMinutesDefault negativeMarkingDefault');

    return res.json({
      success: true,
      configOptions: {
        subjects: ['All', ...subjects],
        topics: ['All', ...topics],
        exams: ['All', ...exams],
        difficulties: ['All', ...difficulties],
        dbExams
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// 2. Generate Solo Test / Mock Test (SECURE: Omit correctAnswer and explanation!)
router.post('/create', authMiddleware, async (req, res) => {
  try {
    const { subject, subSubject, topic, exam, questionCount = 10, difficulty, mode = 'SOLO', timeLimitMinutes } = req.body;

    // SECURITY: Query MUST strictly require status = 'PUBLISHED'
    const query = { status: 'PUBLISHED' };
    if (subject && subject !== 'All') query.subject = subject;
    if (subSubject && subSubject !== 'All') query.subSubject = subSubject;
    if (topic && topic !== 'All') query.topic = topic;
    if (exam && exam !== 'All') query.exam = exam;
    if (difficulty && difficulty !== 'All') query.difficulty = difficulty;

    const countToFetch = Math.max(1, Math.min(100, Number(questionCount)));
    let questions = await Question.find(query).limit(countToFetch).lean();

    if (!questions || questions.length === 0) {
      // Fallback: any published questions
      questions = await Question.find({ status: 'PUBLISHED' }).limit(countToFetch).lean();
    }

    if (!questions || questions.length === 0) {
      return res.status(404).json({ success: false, message: 'No published questions available for the selected filters.' });
    }

    const calculatedTimeLimit = timeLimitMinutes ? Number(timeLimitMinutes) : (mode === 'MOCK' ? 15 : Math.max(5, Math.ceil(questions.length * 1)));

    return res.json({
      success: true,
      test: {
        testId: `test_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        testType: mode,
        subject: subject || 'General Studies',
        topic: topic || 'General',
        exam: exam || 'General',
        timeLimitMinutes: calculatedTimeLimit,
        negativeMarking: mode === 'MOCK' ? 0.25 : (req.body.negativeMarking ?? 0.25),
        totalQuestions: questions.length,
        // SECURITY REQUIREMENT: Never send correctAnswer or explanation before submission
        questions: questions.map(q => ({
          _id: q._id.toString(),
          question: q.question,
          options: q.options,
          subject: q.subject,
          subSubject: q.subSubject,
          topic: q.topic,
          exam: q.exam,
          difficulty: q.difficulty,
          source: q.source,
          sourceType: q.sourceType
        }))
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// 3. Server-Side Scoring & Submission
router.post('/submit', authMiddleware, async (req, res) => {
  try {
    const { testType, subject, topic, exam, answers, timeTakenSeconds, negativeMarking = 0.25 } = req.body;
    
    if (!answers || !Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({ success: false, message: 'Answers payload is required.' });
    }

    // SECURITY & VALIDATION: Fetch authentic question definitions directly from DB by question ID
    const questionIds = answers.map(a => a.questionId).filter(Boolean);
    const dbQuestions = await Question.find({ _id: { $in: questionIds }, status: 'PUBLISHED' }).lean();
    const qMap = new Map(dbQuestions.map(q => [q._id.toString(), q]));

    let correctCount = 0;
    let wrongCount = 0;
    let unattemptedCount = 0;
    let rawScore = 0;

    const answerDetails = [];
    const questionReviews = [];

    for (const item of answers) {
      const dbQ = qMap.get(item.questionId);
      if (!dbQ) continue;

      const isAttempted = item.selectedOption !== undefined && item.selectedOption !== null && item.selectedOption !== -1;
      const trueCorrectAnswer = dbQ.correctAnswer;
      const isCorrect = isAttempted && Number(item.selectedOption) === trueCorrectAnswer;

      if (!isAttempted) {
        unattemptedCount++;
      } else if (isCorrect) {
        correctCount++;
        rawScore += 1;
      } else {
        wrongCount++;
        rawScore -= Number(negativeMarking);
      }

      answerDetails.push({
        questionId: dbQ._id.toString(),
        selectedOption: isAttempted ? Number(item.selectedOption) : -1,
        correctOption: trueCorrectAnswer,
        isCorrect,
        timeTakenSeconds: item.timeTakenSeconds || 5
      });

      questionReviews.push({
        questionId: dbQ._id.toString(),
        question: dbQ.question,
        options: dbQ.options,
        selectedOption: isAttempted ? Number(item.selectedOption) : -1,
        correctAnswer: trueCorrectAnswer,
        isCorrect,
        explanation: dbQ.explanation || '',
        subject: dbQ.subject,
        topic: dbQ.topic,
        source: dbQ.source,
        sourceType: dbQ.sourceType
      });

      // Automatically register wrong questions in Wrong Question / Revision system (No duplicates)
      await recordQuestionAttemptForRevision(
        req.user.id,
        dbQ._id.toString(),
        dbQ.subject || subject || 'General',
        dbQ.topic || topic || 'General',
        isCorrect
      );
    }

    const totalQuestions = answers.length;
    const finalNegativeMarks = parseFloat((wrongCount * Number(negativeMarking)).toFixed(2));
    const score = Math.max(0, parseFloat(rawScore.toFixed(2)));
    const accuracy = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
    const percentage = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;

    const attempt = await TestAttempt.create({
      userId: req.user.id,
      userName: req.user.name,
      testType: testType || 'SOLO',
      subject: subject || 'General Studies',
      topic: topic || 'General',
      exam: exam || 'General',
      totalQuestions,
      correctCount,
      wrongCount,
      unattemptedCount,
      score,
      negativeMarks: finalNegativeMarks,
      accuracy,
      timeTakenSeconds: timeTakenSeconds || 300,
      answers: answerDetails
    });

    // Award XP
    const xpEarned = (correctCount * 10) + (testType === 'MOCK' ? 30 : 20);
    const xpResult = await awardUserXP(req.user.id, xpEarned);

    return res.json({
      success: true,
      result: {
        attemptId: attempt._id,
        score,
        percentage,
        accuracy,
        correctCount,
        wrongCount,
        unattemptedCount,
        totalQuestions,
        negativeMarks: finalNegativeMarks,
        timeTakenSeconds: timeTakenSeconds || 300,
        xpEarned,
        levelUp: xpResult ? xpResult.levelUp : false,
        newLevel: xpResult ? xpResult.newLevel : 1,
        questionReviews
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// 4. User Test Attempt History (Strictly scoped to logged in user)
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const attempts = await TestAttempt.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(30);
    return res.json({ success: true, attempts });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// 5. Get Single Attempt Review Details (Security: Check ownership)
router.get('/history/:attemptId', authMiddleware, async (req, res) => {
  try {
    const attempt = await TestAttempt.findById(req.params.attemptId);
    if (!attempt) {
      return res.status(404).json({ success: false, message: 'Attempt not found.' });
    }

    if (attempt.userId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Access denied to this attempt history.' });
    }

    // Populate question details for review
    const qIds = attempt.answers.map(a => a.questionId).filter(Boolean);
    const dbQuestions = await Question.find({ _id: { $in: qIds } }).lean();
    const qMap = new Map(dbQuestions.map(q => [q._id.toString(), q]));

    const questionReviews = attempt.answers.map(ans => {
      const q = qMap.get(ans.questionId);
      return {
        questionId: ans.questionId,
        question: q ? q.question : 'Question definition unavailable',
        options: q ? q.options : [],
        selectedOption: ans.selectedOption,
        correctAnswer: ans.correctOption,
        isCorrect: ans.isCorrect,
        explanation: q ? q.explanation : '',
        subject: q ? q.subject : attempt.subject,
        topic: q ? q.topic : attempt.topic
      };
    });

    return res.json({
      success: true,
      attempt,
      questionReviews
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

export default router;

