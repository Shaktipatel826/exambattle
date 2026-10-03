import mongoose from 'mongoose';

const examSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, index: true },
  shortName: { type: String, default: '' },
  organization: { type: String, default: '' },
  category: { type: String, enum: ['SSC', 'Railway', 'Banking', 'UP State', 'Other'], default: 'Other', index: true },
  description: { type: String, default: '' },
  subjects: [{ type: String }],
  totalQuestionsDefault: { type: Number, default: 100 },
  timeLimitMinutesDefault: { type: Number, default: 60 },
  negativeMarkingDefault: { type: Number, default: 0.25 },
  active: { type: Boolean, default: true, index: true }
}, { timestamps: true });

export const Exam = mongoose.model('Exam', examSchema);
