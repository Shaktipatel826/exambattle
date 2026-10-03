import mongoose from 'mongoose';

const topicSchema = new mongoose.Schema({
  subjectId: { type: String, required: true, index: true },
  subSubjectId: { type: String, default: '', index: true },
  name: { type: String, required: true },
  slug: { type: String, index: true },
  description: { type: String, default: '' },
  active: { type: Boolean, default: true, index: true }
}, { timestamps: true });

topicSchema.index({ subjectId: 1, name: 1 }, { unique: true });

export const Topic = mongoose.model('Topic', topicSchema);
