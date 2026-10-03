import mongoose from 'mongoose';

const aiJobSchema = new mongoose.Schema({
  jobId: { type: String, required: true, unique: true, index: true },
  sourceDocumentName: { type: String, default: 'Uploaded Material' },
  createdBy: { type: String, required: true },
  provider: { type: String, default: 'Gemini' },
  model: { type: String, default: 'gemini-1.5-flash' },
  status: { type: String, enum: ['QUEUED', 'PROCESSING', 'COMPLETED', 'PARTIAL', 'FAILED'], default: 'QUEUED', index: true },
  generationType: { type: String, enum: ['ONE_LINERS', 'STUDY_NOTES', 'MCQS', 'PRACTICE_TEST', 'ALL'], default: 'ALL' },
  subject: { type: String, default: 'General Studies' },
  topic: { type: String, default: 'General' },
  exam: { type: String, default: 'General' },
  difficulty: { type: String, default: 'Medium' },
  
  // Progress & Metadata
  totalChars: { type: Number, default: 0 },
  totalChunks: { type: Number, default: 0 },
  completedChunks: { type: Number, default: 0 },
  failedChunks: { type: Number, default: 0 },
  
  // Output Counts
  generatedNotesCount: { type: Number, default: 0 },
  generatedOneLinersCount: { type: Number, default: 0 },
  generatedMcqCount: { type: Number, default: 0 },
  duplicateCount: { type: Number, default: 0 },
  invalidCount: { type: Number, default: 0 },
  pendingReviewCount: { type: Number, default: 0 },
  
  // Results Payload
  oneLiners: [{
    text: String,
    topic: String,
    importance: { type: String, default: 'high' },
    source_reference: String
  }],
  studyNotes: {
    title: { type: String, default: '' },
    overview: { type: String, default: '' },
    sections: [{ title: String, content: String }],
    keyConcepts: [{ concept: String, explanation: String }],
    importantFacts: [{ type: String }],
    revisionPoints: [{ type: String }]
  },
  generatedMcqs: [{
    questionId: String,
    question: String,
    options: [String],
    correctAnswer: Number,
    explanation: String,
    subject: String,
    topic: String,
    difficulty: String,
    sourceReference: String,
    duplicateFlag: Boolean,
    status: { type: String, default: 'PENDING_REVIEW' }
  }],
  
  errorDetails: { type: String, default: '' }
}, { timestamps: true });

export const AIJob = mongoose.model('AIJob', aiJobSchema);
