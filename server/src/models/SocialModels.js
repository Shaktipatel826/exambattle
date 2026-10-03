import mongoose from 'mongoose';

const friendshipSchema = new mongoose.Schema({
  requesterId: { type: String, required: true, index: true },
  recipientId: { type: String, required: true, index: true },
  status: { type: String, enum: ['PENDING', 'ACCEPTED', 'REJECTED'], default: 'PENDING' }
}, { timestamps: true });

export const Friendship = mongoose.model('Friendship', friendshipSchema);

const challengeSchema = new mongoose.Schema({
  senderId: { type: String, required: true },
  senderName: { type: String, required: true },
  receiverId: { type: String, required: true, index: true },
  subject: { type: String, required: true },
  topic: { type: String, default: 'Mixed' },
  questionCount: { type: Number, default: 10 },
  difficulty: { type: String, default: 'Medium' },
  status: { type: String, enum: ['PENDING', 'ACCEPTED', 'DECLINED', 'COMPLETED'], default: 'PENDING' },
  roomCode: { type: String, default: '' }
}, { timestamps: true });

export const Challenge = mongoose.model('Challenge', challengeSchema);

const studyRoomSchema = new mongoose.Schema({
  roomName: { type: String, required: true },
  hostId: { type: String, required: true },
  members: [{ type: String }], // userIds
  goals: [{
    text: String,
    targetCount: Number,
    completed: { type: Boolean, default: false }
  }],
  active: { type: Boolean, default: true }
}, { timestamps: true });

export const StudyRoom = mongoose.model('StudyRoom', studyRoomSchema);
