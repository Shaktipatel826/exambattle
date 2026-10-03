import express from 'express';
import { User } from '../models/User.js';
import { Friendship, Challenge, StudyRoom } from '../models/SocialModels.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Search Friends
router.get('/search-users', authMiddleware, async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) return res.json({ success: true, users: [] });

    const users = await User.find({
      name: { $regex: query, $options: 'i' },
      _id: { $ne: req.user.id }
    }).select('name email avatar level targetExams').limit(10);

    return res.json({ success: true, users });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// List My Friends
router.get('/friends', authMiddleware, async (req, res) => {
  try {
    const friendships = await Friendship.find({
      $or: [
        { requesterId: req.user.id, status: 'ACCEPTED' },
        { recipientId: req.user.id, status: 'ACCEPTED' }
      ]
    });

    const friendIds = friendships.map(f => f.requesterId === req.user.id ? f.recipientId : f.requesterId);
    const friends = await User.find({ _id: { $in: friendIds } }).select('name email avatar level xp streak targetExams');

    return res.json({ success: true, friends });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// Send Friend Challenge
router.post('/challenge', authMiddleware, async (req, res) => {
  try {
    const { receiverId, subject, topic, questionCount, difficulty } = req.body;
    const challenge = await Challenge.create({
      senderId: req.user.id,
      senderName: req.user.name,
      receiverId,
      subject: subject || 'Indian Polity',
      topic: topic || 'Fundamental Rights',
      questionCount: questionCount || 10,
      difficulty: difficulty || 'Medium',
      status: 'PENDING'
    });
    return res.status(201).json({ success: true, challenge });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// List Study Rooms
router.get('/study-rooms', authMiddleware, async (req, res) => {
  try {
    const rooms = await StudyRoom.find({ active: true }).limit(10);
    return res.json({ success: true, studyRooms: rooms });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
