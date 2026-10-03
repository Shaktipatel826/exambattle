import { User } from '../models/User.js';
import { XPTransaction, CoinTransaction } from '../models/GamificationSystem.js';

export const XP_CONFIG = {
  TEST_COMPLETED: 30,
  CORRECT_ANSWER: 10,
  DAILY_CHALLENGE: 50,
  REVISION_COMPLETED: 25,
  STREAK_BONUS: 40,
  BATTLE_COMPLETED: 20,
  BATTLE_WIN: 50,
  STUDY_SESSION_COMPLETED: 20,
  BADGE_UNLOCKED: 30
};

export const COIN_CONFIG = {
  DAILY_CHALLENGE: 25,
  STREAK_MILESTONE: 50,
  BATTLE_WIN: 30,
  BADGE_UNLOCKED: 20
};

/**
 * Calculates current level and progress details based on total XP
 */
export const calculateLevelFromXP = (totalXp = 0) => {
  const level = Math.floor(totalXp / 500) + 1;
  const xpCurrentLevelStart = (level - 1) * 500;
  const xpNextLevelStart = level * 500;
  const xpInCurrentLevel = totalXp - xpCurrentLevelStart;
  const xpRequiredForNext = 500;
  const progressPercentage = Math.min(100, Math.round((xpInCurrentLevel / xpRequiredForNext) * 100));

  return {
    level,
    totalXp,
    xpInCurrentLevel,
    xpRequiredForNext,
    progressPercentage
  };
};

/**
 * Award XP to user with idempotency guard and transaction audit recording
 */
export const awardUserXP = async (userId, xpAmount, reason = 'TEST_COMPLETED', referenceType = 'SYSTEM', referenceId = '') => {
  if (!userId || xpAmount <= 0) return null;

  // Idempotency check to prevent duplicate XP awards for the same action
  if (referenceType && referenceId) {
    const existing = await XPTransaction.findOne({ userId, referenceType, referenceId });
    if (existing) {
      console.log(`[XP System] Idempotent skip: Duplicate XP request for ${reason} (${referenceId}).`);
      const u = await User.findById(userId);
      return { user: u, levelUp: false, newLevel: u?.level || 1 };
    }
  }

  const user = await User.findById(userId);
  if (!user) return null;

  // Save Audit Transaction
  await XPTransaction.create({
    userId,
    amount: xpAmount,
    reason,
    referenceType,
    referenceId
  });

  const oldLevel = user.level || 1;
  user.xp = (user.xp || 0) + xpAmount;
  const levelInfo = calculateLevelFromXP(user.xp);
  user.level = levelInfo.level;
  const levelUp = levelInfo.level > oldLevel;

  await user.save();
  return { user, levelUp, newLevel: user.level, levelInfo };
};

/**
 * Award Coins to user with transaction recording
 */
export const awardUserCoins = async (userId, amount, reason = 'DAILY_CHALLENGE', referenceId = '') => {
  if (!userId || amount <= 0) return null;

  const user = await User.findById(userId);
  if (!user) return null;

  await CoinTransaction.create({
    userId,
    amount,
    reason,
    referenceId
  });

  user.coins = (user.coins || 0) + amount;
  await user.save();
  return user.coins;
};

/**
 * Updates learning streak based on qualifying activity date
 */
export const updateQualifyingStreak = async (userId) => {
  const user = await User.findById(userId);
  if (!user) return null;

  const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const lastDate = user.lastQualifyingDate;

  if (lastDate === todayStr) {
    // Same day activity: Do not double-count streak
    return user.streak;
  }

  const todayDate = new Date(todayStr);
  let newStreak = 1;

  if (lastDate) {
    const lastD = new Date(lastDate);
    const diffDays = Math.round((todayDate - lastD) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      // Consecutive day: increment streak
      newStreak = (user.streak || 1) + 1;
    } else if (diffDays > 1) {
      // Missed a day: reset streak to 1
      newStreak = 1;
    }
  }

  user.streak = newStreak;
  user.longestStreak = Math.max(user.longestStreak || 1, newStreak);
  user.lastQualifyingDate = todayStr;
  user.lastActiveDate = new Date();

  await user.save();
  return newStreak;
};

/**
 * Evaluates and unlocks badges server-side
 */
export const checkAndUnlockBadges = async (userId, stats = {}) => {
  const user = await User.findById(userId);
  if (!user) return [];

  const newBadges = [];
  const addBadge = (code) => {
    if (!user.unlockedBadges.includes(code)) {
      user.unlockedBadges.push(code);
      newBadges.push(code);
    }
  };

  if (stats.testAttemptsCount >= 1) addBadge('FIRST_TEST');
  if (user.streak >= 3) addBadge('STREAK_3');
  if (user.streak >= 7) addBadge('STREAK_7');
  if (stats.totalCorrect >= 100) addBadge('QUESTIONS_100');
  if (stats.totalCorrect >= 500) addBadge('QUESTIONS_500');
  if (stats.revisionsCompleted >= 1) addBadge('REVISION_FIRST');
  if (stats.battlesCompleted >= 1) addBadge('BATTLE_FIRST');
  if (stats.battlesWon >= 1) addBadge('BATTLE_WINNER');
  if (stats.masteredCount >= 50) addBadge('MASTERY_50');

  if (newBadges.length > 0) {
    for (const bCode of newBadges) {
      await awardUserXP(user._id.toString(), XP_CONFIG.BADGE_UNLOCKED, 'BADGE_UNLOCKED', 'BADGE', bCode);
      await awardUserCoins(user._id.toString(), COIN_CONFIG.BADGE_UNLOCKED, 'BADGE_UNLOCKED', bCode);
    }
  }

  return newBadges;
};

