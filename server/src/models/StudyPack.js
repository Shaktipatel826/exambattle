import mongoose from 'mongoose';

const studyPackSchema = new mongoose.Schema({
  title: { type: String, required: true },
  userId: { type: String, required: true, index: true },
  fileName: { type: String, default: '' },
  fileType: { type: String, default: 'TXT' }, // TXT, CSV, PDF, DOCX, XLSX
  sourceType: { type: String, enum: ['SOURCE_BASED', 'AI_GENERATED'], default: 'SOURCE_BASED' },
  rawContentText: { type: String, default: '' },
  
  // Content Sections
  shortNotes: [{ type: String }],
  oneLiners: [{ type: String }],
  keyConcepts: [{
    concept: String,
    explanation: String
  }],
  importantPoints: [{ type: String }],
  commonConfusions: [{
    factA: String,
    factB: String,
    clarification: String
  }],
  originalQuestions: [{
    question: String,
    answer: String,
    timestamp: String
  }],
  newMCQs: [{
    question: String,
    options: [String],
    correctAnswer: Number,
    explanation: String,
    sourceType: { type: String, default: 'SOURCE_BASED' }
  }],
  revisionQuestions: [{
    question: String,
    shortAnswer: String
  }],
  
  processingStatus: { type: String, enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'], default: 'COMPLETED' },
  processingProgress: { type: Number, default: 100 },
  adminReviewed: { type: Boolean, default: false }
}, { timestamps: true });

export const StudyPack = mongoose.model('StudyPack', studyPackSchema);
