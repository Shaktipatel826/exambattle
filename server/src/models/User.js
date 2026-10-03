import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['STUDENT', 'ADMIN'], default: 'STUDENT' },
  avatar: { type: String, default: '' },
  targetExams: [{ type: String }], // e.g. ['SSC CGL', 'UP Police', 'Railway NTPC']
  xp: { type: Number, default: 0 },
  level: { type: Number, default: 1 },
  coins: { type: Number, default: 0 },
  streak: { type: Number, default: 1 },
  longestStreak: { type: Number, default: 1 },
  lastActiveDate: { type: Date, default: Date.now },
  lastQualifyingDate: { type: String, default: '' }, // YYYY-MM-DD
  unlockedBadges: [{ type: String }], // badge codes
  completedMissions: [{
    missionId: String,
    dateCompleted: Date
  }],
  preferences: {
    language: { type: String, default: 'en' }, // 'en' or 'hi'
    theme: { type: String, default: 'dark' }
  }
}, { timestamps: true });

userSchema.index({ xp: -1 });
userSchema.index({ coins: -1 });

export const User = mongoose.model('User', userSchema);

