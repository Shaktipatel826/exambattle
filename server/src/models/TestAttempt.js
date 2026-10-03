import mongoose from 'mongoose';

const testAttemptSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  userName: { type: String, default: '' },
  testType: { type: String, enum: ['SOLO', 'MOCK', 'BATTLE', 'REVISION', 'PYQ', 'WEAK_TOPIC'], default: 'SOLO' },
  subject: { type: String, default: 'General' },
  topic: { type: String, default: 'Mixed' },
  exam: { type: String, default: 'General' },
  roomId: { type: String, default: null }, // for battle tests
  totalQuestions: { type: Number, required: true },
  correctCount: { type: Number, required: true },
  wrongCount: { type: Number, required: true },
  unattemptedCount: { type: Number, required: true },
  score: { type: Number, required: true },
  negativeMarks: { type: Number, default: 0 },
  accuracy: { type: Number, required: true }, // percentage
  timeTakenSeconds: { type: Number, required: true },
  
  answers: [{
    questionId: String,
    selectedOption: Number, // index 0..3 or -1 for unattempted
    correctOption: Number,
    isCorrect: Boolean,
    timeTakenSeconds: Number
  }]
}, { timestamps: true });

testAttemptSchema.index({ userId: 1, createdAt: -1 });

export const TestAttempt = mongoose.model('TestAttempt', testAttemptSchema);
