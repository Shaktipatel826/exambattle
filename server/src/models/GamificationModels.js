import mongoose from 'mongoose';

const badgeSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  icon: { type: String, default: 'Trophy' }, // Lucide icon name
  category: { type: String, enum: ['STREAK', 'BATTLE', 'PRACTICE', 'REVISION', 'SUBJECT', 'SPECIAL'], default: 'SPECIAL' }
}, { timestamps: true });

export const Badge = mongoose.model('Badge', badgeSchema);

const missionSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  targetCount: { type: Number, required: true },
  type: { type: String, enum: ['QUESTIONS_ATTEMPTED', 'REVISION_COMPLETED', 'BATTLE_COMPLETED', 'POLITY_PRACTICE', 'GK_PRACTICE'], required: true },
  rewardXp: { type: Number, default: 50 },
  active: { type: Boolean, default: true }
}, { timestamps: true });

export const Mission = mongoose.model('Mission', missionSchema);

const currentAffairSchema = new mongoose.Schema({
  title: { type: String, required: true },
  date: { type: Date, required: true, default: Date.now },
  category: { type: String, required: true }, // National, International, Sports, Science, Economy
  topic: { type: String, required: true },
  summary: { type: String, required: true },
  question: { type: String, default: '' },
  options: [{ type: String }],
  correctAnswer: { type: Number, default: 0 },
  explanation: { type: String, default: '' },
  source: { type: String, default: 'Official Current Affairs' },
  verified: { type: Boolean, default: true }
}, { timestamps: true });

export const CurrentAffair = mongoose.model('CurrentAffair', currentAffairSchema);

const reportSchema = new mongoose.Schema({
  questionId: { type: String, required: true },
  userId: { type: String, required: true },
  userName: { type: String, default: 'Student' },
  reason: { type: String, enum: ['WRONG_ANSWER', 'INCORRECT_EXPLANATION', 'DUPLICATE', 'TYPO', 'WRONG_PYQ_LABEL'], required: true },
  comments: { type: String, default: '' },
  status: { type: String, enum: ['PENDING', 'RESOLVED', 'DISMISSED'], default: 'PENDING' }
}, { timestamps: true });

export const Report = mongoose.model('Report', reportSchema);
