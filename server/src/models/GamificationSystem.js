import mongoose from 'mongoose';

const xpTransactionSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  amount: { type: Number, required: true },
  reason: {
    type: String,
    enum: [
      'TEST_COMPLETED',
      'CORRECT_ANSWER',
      'DAILY_CHALLENGE',
      'REVISION_COMPLETED',
      'STREAK_BONUS',
      'BATTLE_COMPLETED',
      'BATTLE_WIN',
      'STUDY_SESSION_COMPLETED',
      'BADGE_UNLOCKED'
    ],
    required: true
  },
  referenceType: { type: String, default: 'SYSTEM' },
  referenceId: { type: String, default: '' }
}, { timestamps: true });

xpTransactionSchema.index({ userId: 1, referenceType: 1, referenceId: 1 });

export const XPTransaction = mongoose.model('XPTransaction', xpTransactionSchema);

const coinTransactionSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  amount: { type: Number, required: true },
  reason: { type: String, required: true },
  referenceId: { type: String, default: '' }
}, { timestamps: true });

export const CoinTransaction = mongoose.model('CoinTransaction', coinTransactionSchema);

const dailyChallengeSchema = new mongoose.Schema({
  dateStr: { type: String, required: true, unique: true, index: true }, // YYYY-MM-DD
  questionIds: [{ type: String }],
  totalQuestions: { type: Number, default: 10 },
  rewardXp: { type: Number, default: 50 },
  rewardCoins: { type: Number, default: 25 }
}, { timestamps: true });

export const DailyChallenge = mongoose.model('DailyChallenge', dailyChallengeSchema);

const dailyChallengeAttemptSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  dateStr: { type: String, required: true, index: true },
  score: { type: Number, required: true },
  accuracy: { type: Number, required: true },
  completedAt: { type: Date, default: Date.now }
}, { timestamps: true });

dailyChallengeAttemptSchema.index({ userId: 1, dateStr: 1 }, { unique: true });

export const DailyChallengeAttempt = mongoose.model('DailyChallengeAttempt', dailyChallengeAttemptSchema);
