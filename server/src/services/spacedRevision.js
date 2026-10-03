import { Mistake } from '../models/Mistake.js';

/**
 * Updates mistake record after a revision attempt
 */
export const recordQuestionAttemptForRevision = async (userId, questionId, subject, topic, isCorrect) => {
  let mistake = await Mistake.findOne({ userId, questionId });

  const now = new Date();

  if (!mistake) {
    if (!isCorrect) {
      mistake = new Mistake({
        userId,
        questionId,
        subject,
        topic,
        wrongCount: 1,
        correctStreak: 0,
        lastAttemptedDate: now,
        nextRevisionDate: new Date(now.getTime() + 24 * 60 * 60 * 1000), // 1 day
        intervalDays: 1,
        mastered: false
      });
      await mistake.save();
    }
    return mistake;
  }

  // If mistake record exists
  mistake.lastAttemptedDate = now;

  if (isCorrect) {
    mistake.correctStreak += 1;
    // Spaced repetition intervals: 1 -> 3 -> 7 -> 14 -> 30 days
    if (mistake.correctStreak === 1) mistake.intervalDays = 3;
    else if (mistake.correctStreak === 2) mistake.intervalDays = 7;
    else if (mistake.correctStreak === 3) mistake.intervalDays = 14;
    else if (mistake.correctStreak >= 4) {
      mistake.intervalDays = 30;
      mistake.mastered = true;
    }

    const nextTime = now.getTime() + mistake.intervalDays * 24 * 60 * 60 * 1000;
    mistake.nextRevisionDate = new Date(nextTime);
  } else {
    // Incorrect answer resets interval
    mistake.wrongCount += 1;
    mistake.correctStreak = 0;
    mistake.intervalDays = 1;
    mistake.mastered = false;
    mistake.nextRevisionDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 1 day
  }

  await mistake.save();
  return mistake;
};
