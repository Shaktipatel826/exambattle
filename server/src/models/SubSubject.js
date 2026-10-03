import mongoose from 'mongoose';

const subSubjectSchema = new mongoose.Schema({
  subjectId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  slug: { type: String, index: true },
  description: { type: String, default: '' },
  active: { type: Boolean, default: true, index: true }
}, { timestamps: true });

subSubjectSchema.index({ subjectId: 1, name: 1 }, { unique: true });

export const SubSubject = mongoose.model('SubSubject', subSubjectSchema);
