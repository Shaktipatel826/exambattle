import mongoose from 'mongoose';

const savedTestSchema = new mongoose.Schema({
  title: { type: String, required: true },
  userId: { type: String, required: true, index: true },
  userName: { type: String, default: '' },
  subject: { type: String, required: true },
  topic: { type: String, default: 'General' },
  difficulty: { type: String, default: 'Mixed' },
  language: { type: String, enum: ['en', 'hi', 'bilingual'], default: 'en' },
  mode: { type: String, enum: ['comprehensive', 'quick'], default: 'quick' },
  questionCount: { type: Number, required: true },
  questions: [{
    question: { type: String, required: true },
    // MCQ fields (used when questionType === 'mcq')
    options: [{ type: String }],
    correctAnswer: { type: Number, default: null },   // 0-indexed; null for short_answer
    // Short-answer fields (used when questionType === 'short_answer')
    referenceAnswer: { type: String, default: '' },
    questionType: { type: String, enum: ['mcq', 'short_answer'], default: 'mcq' },
    explanation: { type: String, default: '' },
    subject: String,
    topic: String,
    difficulty: String,
    language: String,
    sourceReference: String,
    _pipeline: mongoose.Schema.Types.Mixed
  }],
  stats: { type: mongoose.Schema.Types.Mixed, default: {} },
  sourceDocumentName: { type: String, default: 'Unknown Source' },
  extractedChars: { type: Number, default: 0 }
}, { timestamps: true });

savedTestSchema.index({ userId: 1, createdAt: -1 });

export const SavedTest = mongoose.model('SavedTest', savedTestSchema);
