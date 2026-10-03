import mongoose from 'mongoose';

const subjectSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, index: true },
  slug: { type: String, index: true },
  code: { type: String, default: '' },
  description: { type: String, default: '' },
  icon: { type: String, default: 'BookOpen' },
  active: { type: Boolean, default: true, index: true },
  subSubjects: [{
    name: String,
    topics: [String]
  }],
  topics: [{ type: String }]
}, { timestamps: true });

export const Subject = mongoose.model('Subject', subjectSchema);
