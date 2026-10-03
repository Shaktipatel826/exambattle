import mongoose from 'mongoose';

const mistakeSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  questionId: { type: String, required: true, index: true },
  subject: { type: String, required: true, index: true },
  topic: { type: String, required: true, index: true },
  wrongCount: { type: Number, default: 1 },
  correctStreak: { type: Number, default: 0 },
  lastAttemptedDate: { type: Date, default: Date.now },
  nextRevisionDate: { type: Date, default: Date.now, index: true },
  intervalDays: { type: Number, default: 1 }, // 1, 3, 7, 14, 30 days
  mastered: { type: Boolean, default: false }
}, { timestamps: true });

mistakeSchema.index({ userId: 1, subject: 1, nextRevisionDate: 1 });

export const Mistake = mongoose.model('Mistake', mistakeSchema);
