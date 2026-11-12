import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema({
  question: { type: String, required: true },
  options: [{ type: String, required: true }], // 4 options A, B, C, D
  correctAnswer: { type: Number, required: true }, // Index 0, 1, 2, or 3
  questionType: { type: String, enum: ['mcq', 'short_answer'], default: 'mcq' }, // FIX-3: stored for reliable type identification
  explanation: { type: String, default: '' },
  subject: { type: String, required: true, index: true },
  subSubject: { type: String, default: '' },
  topic: { type: String, required: true, index: true },
  exam: { type: String, default: 'General', index: true },
  examYear: { type: Number },
  examShift: { type: String, default: '' },
  difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard'], default: 'Medium' },
  language: { type: String, enum: ['en', 'hi', 'bilingual'], default: 'en' },
  source: { type: String, default: 'Question Bank' },
  sourceType: {
    type: String,
    enum: ['ADMIN_CREATED', 'VERIFIED_PYQ', 'IMPORTED', 'AI_GENERATED', 'SOURCE_TRANSCRIPT', 'SOURCE_BASED', 'CURRENT_AFFAIRS', 'STUDENT_PERSONAL'],
    default: 'ADMIN_CREATED',
    index: true
  },
  sourceReference: { type: String, default: '' },
  tags: [{ type: String }],
  verified: { type: Boolean, default: false, index: true },
  status: { type: String, enum: ['PUBLISHED', 'PENDING_REVIEW', 'REJECTED', 'DRAFT'], default: 'PUBLISHED', index: true },
  createdBy: { type: String, default: 'System' },
  duplicateFlag: { type: Boolean, default: false },
  versionHistory: [{
    question: String,
    options: [String],
    correctAnswer: Number,
    explanation: String,
    editedBy: String,
    editedAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

questionSchema.index({ subject: 1, topic: 1, exam: 1, status: 1 });

export const Question = mongoose.model('Question', questionSchema);
