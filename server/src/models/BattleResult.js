import mongoose from 'mongoose';

/**
 * BattleResult — durable storage for completed battle scorecards.
 *
 * Purpose:
 *   1. Survive server restarts (Render free tier spins down and clears activeRooms).
 *   2. Allow players who missed the socket battle_finished event to retrieve their
 *      scorecard via REST GET /api/battle-results/:roomCode.
 *   3. Keep the data for 24 hours, then auto-delete (TTL index).
 *
 * This is ADDITIVE — it does NOT replace TestAttempt (per-player historical record).
 * BattleResult stores the full shared scorecard for a room (leaderboard + questions).
 */
const battleResultSchema = new mongoose.Schema({
  roomCode: { type: String, required: true, unique: true, index: true, uppercase: true },
  status:   { type: String, default: 'FINISHED' },
  finishedAt: { type: Date, default: Date.now },

  config: {
    subject:          { type: String, default: 'General' },
    topic:            { type: String, default: 'General' },
    questionCount:    { type: Number, default: 0 },
    timeLimitMinutes: { type: Number, default: 5 },
    negativeMarking:  { type: Number, default: 0.25 },
    difficulty:       { type: String, default: 'Mixed' },
  },

  // Full sorted leaderboard (rank 1 = winner)
  leaderboard: [{
    rank:            Number,
    userId:          String,
    name:            String,
    score:           Number,
    accuracy:        Number,
    correctCount:    Number,
    partialCount:    Number,
    wrongCount:      Number,
    unattemptedCount: Number,
    answerScores:    mongoose.Schema.Types.Mixed,   // { qIdx: 0-100 }
    submittedAnswers: mongoose.Schema.Types.Mixed,  // { qIdx: optionIdx | text }
  }],

  // Full question set WITH correctAnswer and explanation (revealed after finish)
  questions: { type: mongoose.Schema.Types.Mixed, default: [] },
}, {
  timestamps: false,
  // Lean document — no virtuals needed
});

// Allow players to look up their own results (secondary index)
battleResultSchema.index({ 'leaderboard.userId': 1 });

// TTL: auto-delete 24 hours after finishedAt (keeps DB clean; 86400 seconds)
battleResultSchema.index({ finishedAt: 1 }, { expireAfterSeconds: 86400 });

export const BattleResult = mongoose.model('BattleResult', battleResultSchema);
