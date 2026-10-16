import { Question } from '../models/Question.js';
import { TestAttempt } from '../models/TestAttempt.js';
import { awardUserXP } from '../services/gamification.js';

// In-memory active battle rooms cache
const activeRooms = new Map();

/**
 * Generate a 6-character room code (e.g. K7P4XZ)
 */
export const generateRoomCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// Periodic Cleanup for abandoned rooms (runs every 15 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of activeRooms.entries()) {
    // Purge rooms inactive for > 1 hour or finished rooms > 30 minutes old
    const ageMs = now - (room.createdAt || now);
    if (ageMs > 60 * 60 * 1000 || (room.status === 'FINISHED' && ageMs > 30 * 60 * 1000)) {
      activeRooms.delete(code);
      console.log(`[Socket Housekeeping] Cleaned up abandoned room: ${code}`);
    }
  }
}, 15 * 60 * 1000);

export const initializeBattleSocket = (io) => {
  io.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    // Create Room
    socket.on('create_room', async ({ user, config }, callback) => {
      try {
        if (!user || (!user.id && !user._id)) {
          if (typeof callback === 'function') callback({ success: false, message: 'Unauthorized room creation.' });
          return;
        }

        const roomCode = generateRoomCode();
        
        let questions = [];
        const query = { status: 'PUBLISHED' };
        if (config.subject && config.subject !== 'All') query.subject = config.subject;
        if (config.topic && config.topic !== 'All') query.topic = config.topic;
        if (config.difficulty && config.difficulty !== 'All') query.difficulty = config.difficulty;

        const requestedCount = config.questionCount || 10;

        // Use $sample for random selection — prevents always serving the same questions
        const availableCount = await Question.countDocuments(query);
        if (availableCount > 0) {
          const sampleSize = Math.min(requestedCount, availableCount);
          questions = await Question.aggregate([
            { $match: query },
            { $sample: { size: sampleSize } }
          ]);
        }

        if (!questions || questions.length === 0) {
          questions = getFallbackBattleQuestions(requestedCount, config.subject || 'Polity');
        }

        if (questions.length < requestedCount) {
          console.warn(`[Battle] Requested ${requestedCount} questions for subject="${config.subject}", only ${questions.length} available.`);
        }

        const roomState = {
          roomId: roomCode,
          roomCode,
          hostId: user.id || user._id,
          config: {
            subject: config.subject || 'General Studies',
            topic: config.topic || 'General',
            questionCount: questions.length,
            timeLimitMinutes: config.timeLimitMinutes || 5,
            negativeMarking: config.negativeMarking || 0.25,
            difficulty: config.difficulty || 'Medium'
          },
          status: 'LOBBY',
          questions,
          players: [{
            userId: user.id || user._id,
            name: user.name,
            socketId: socket.id,
            isReady: true,
            status: 'Thinking',
            score: 0,
            correctCount: 0,
            wrongCount: 0,
            unattemptedCount: questions.length,
            answers: {}
          }],
          startTime: null,
          endTime: null,
          createdAt: Date.now()
        };

        activeRooms.set(roomCode, roomState);
        socket.join(roomCode);

        if (typeof callback === 'function') {
          callback({ success: true, roomCode, room: roomState });
        }
      } catch (err) {
        if (typeof callback === 'function') callback({ success: false, message: err.message });
      }
    });

    // Join Room
    socket.on('join_room', ({ roomCode, user }, callback) => {
      if (!roomCode) return;
      const cleanCode = roomCode.trim().toUpperCase();
      const room = activeRooms.get(cleanCode);
      if (!room) {
        if (typeof callback === 'function') callback({ success: false, message: 'Battle Room not found. Check room code.' });
        return;
      }

      if (room.status === 'FINISHED') {
        if (typeof callback === 'function') callback({ success: false, message: 'Battle has already ended.' });
        return;
      }

      let existingPlayer = room.players.find(p => p.userId === (user.id || user._id));
      if (existingPlayer) {
        existingPlayer.socketId = socket.id;
      } else {
        // ENFORCE MAX CAPACITY: 3 PLAYERS MAXIMUM
        if (room.players.length >= 3) {
          if (typeof callback === 'function') callback({ success: false, message: 'Room is full (Max 3 players).' });
          return;
        }
        room.players.push({
          userId: user.id || user._id,
          name: user.name,
          socketId: socket.id,
          isReady: false, // Non-host starts unready
          status: 'Thinking',
          score: 0,
          correctCount: 0,
          wrongCount: 0,
          unattemptedCount: room.questions.length,
          answers: {}
        });
      }

      socket.join(room.roomCode);
      io.to(room.roomCode).emit('room_updated', sanitizeRoomState(room));

      if (typeof callback === 'function') {
        callback({ success: true, room: sanitizeRoomState(room) });
      }
    });

    // Toggle Ready State
    socket.on('toggle_ready', ({ roomCode, userId }, callback) => {
      const cleanCode = roomCode.trim().toUpperCase();
      const room = activeRooms.get(cleanCode);
      if (!room) return;

      const player = room.players.find(p => p.userId === userId);
      if (player) {
        player.isReady = !player.isReady;
        io.to(cleanCode).emit('room_updated', sanitizeRoomState(room));
        if (typeof callback === 'function') callback({ success: true, isReady: player.isReady });
      }
    });

    // Leave Room
    socket.on('leave_room', ({ roomCode, userId }) => {
      const cleanCode = roomCode ? roomCode.trim().toUpperCase() : null;
      if (!cleanCode) return;
      const room = activeRooms.get(cleanCode);
      if (!room) return;

      room.players = room.players.filter(p => p.userId !== userId);
      if (room.players.length === 0) {
        activeRooms.delete(cleanCode);
      } else {
        if (room.hostId === userId) {
          room.hostId = room.players[0].userId; // Reassign host
          room.players[0].isReady = true;
        }
        io.to(cleanCode).emit('room_updated', sanitizeRoomState(room));
      }
    });

    // Start Battle (Host Only)
    socket.on('start_battle', ({ roomCode, userId }, callback) => {
      const cleanCode = roomCode.trim().toUpperCase();
      const room = activeRooms.get(cleanCode);
      if (!room) return;

      if (room.hostId !== userId) {
        if (typeof callback === 'function') callback({ success: false, message: 'Only host can start the battle.' });
        return;
      }

      const durationMs = room.config.timeLimitMinutes * 60 * 1000;
      room.status = 'IN_PROGRESS';
      room.startTime = Date.now();
      room.endTime = room.startTime + durationMs;

      // SECURITY: Strip correct answers and explanations before starting live battle
      io.to(cleanCode).emit('battle_started', {
        status: 'IN_PROGRESS',
        startTime: room.startTime,
        endTime: room.endTime,
        questions: room.questions.map(q => ({
          _id: q._id,
          question: q.question,
          options: q.options,
          subject: q.subject,
          topic: q.topic,
          difficulty: q.difficulty
        }))
      });

      if (typeof callback === 'function') callback({ success: true });
    });

    // Submit Answer for a Question (Live status update WITHOUT leaking chosen option)
    socket.on('submit_answer', async ({ roomCode, userId, questionIndex, selectedOptionIndex }) => {
      const cleanCode = roomCode.trim().toUpperCase();
      const room = activeRooms.get(cleanCode);
      if (!room || room.status !== 'IN_PROGRESS') return;

      const player = room.players.find(p => p.userId === userId);
      if (!player) return;

      const question = room.questions[questionIndex];
      if (!question) return;

      // Duplicate submission guard
      if (player.answers[questionIndex] !== undefined) return;

      player.answers[questionIndex] = selectedOptionIndex;
      player.status = 'Answered';

      // PRIVACY ENFORCEMENT: Broadcast answered status WITHOUT leaking selected option value
      io.to(cleanCode).emit('player_status_changed', {
        userId,
        questionIndex,
        players: room.players.map(p => ({
          userId: p.userId,
          name: p.name,
          answeredCurrent: p.answers[questionIndex] !== undefined,
          totalSubmitted: Object.keys(p.answers).length
        }))
      });

      const allFinished = room.players.every(p => Object.keys(p.answers).length >= room.questions.length);
      if (allFinished) {
        await finishBattle(room, io);
      }
    });

    // Manual Finish Request
    socket.on('finish_battle_early', async ({ roomCode, userId }) => {
      const cleanCode = roomCode.trim().toUpperCase();
      const room = activeRooms.get(cleanCode);
      if (!room || room.status !== 'IN_PROGRESS') return;
      await finishBattle(room, io);
    });

    // Rematch Request
    socket.on('request_rematch', async ({ roomCode, userId }, callback) => {
      const cleanCode = roomCode.trim().toUpperCase();
      const room = activeRooms.get(cleanCode);
      if (!room) return;

      room.status = 'LOBBY';
      room.startTime = null;
      room.endTime = null;
      room.players.forEach(p => {
        p.score = 0;
        p.correctCount = 0;
        p.wrongCount = 0;
        p.unattemptedCount = room.questions.length;
        p.answers = {};
        p.status = 'Thinking';
      });

      const freshQuestions = await Question.find({ subject: room.config.subject, status: 'PUBLISHED' }).limit(room.config.questionCount).lean();
      if (freshQuestions && freshQuestions.length > 0) {
        room.questions = freshQuestions;
      }

      io.to(cleanCode).emit('room_updated', sanitizeRoomState(room));
      if (typeof callback === 'function') callback({ success: true, room: sanitizeRoomState(room) });
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] Client disconnected: ${socket.id}`);
    });
  });
};

// Helper: Sanitize room state for lobby updates (omits full answers if present)
function sanitizeRoomState(room) {
  return {
    roomId: room.roomId,
    roomCode: room.roomCode,
    hostId: room.hostId,
    config: room.config,
    status: room.status,
    startTime: room.startTime,
    endTime: room.endTime,
    players: room.players.map(p => ({
      userId: p.userId,
      name: p.name,
      isReady: p.isReady,
      status: p.status,
      score: room.status === 'FINISHED' ? p.score : undefined,
      accuracy: room.status === 'FINISHED' ? p.accuracy : undefined
    }))
  };
}


async function finishBattle(room, io) {
  room.status = 'FINISHED';

  room.players.forEach(p => {
    let correct = 0;
    let wrong = 0;
    let score = 0;

    room.questions.forEach((q, idx) => {
      const selected = p.answers[idx];
      if (selected !== undefined && selected !== -1) {
        if (selected === q.correctAnswer) {
          correct++;
          score += 1;
        } else {
          wrong++;
          score -= room.config.negativeMarking || 0.25;
        }
      }
    });

    const unattempted = room.questions.length - (correct + wrong);
    p.correctCount = correct;
    p.wrongCount = wrong;
    p.unattemptedCount = unattempted;
    p.score = Math.max(0, parseFloat(score.toFixed(2)));
    p.accuracy = room.questions.length > 0 ? Math.round((correct / room.questions.length) * 100) : 0;
  });

  room.players.sort((a, b) => b.score - a.score);

  for (let i = 0; i < room.players.length; i++) {
    const p = room.players[i];
    try {
      await TestAttempt.create({
        userId: p.userId,
        userName: p.name,
        testType: 'BATTLE',
        subject: room.config.subject,
        topic: room.config.topic,
        totalQuestions: room.questions.length,
        correctCount: p.correctCount,
        wrongCount: p.wrongCount,
        unattemptedCount: p.unattemptedCount,
        score: p.score,
        accuracy: p.accuracy,
        timeTakenSeconds: room.config.timeLimitMinutes * 60
      });

      const bonusXp = i === 0 ? 50 : 20;
      await awardUserXP(p.userId, (p.correctCount * 10) + bonusXp);
    } catch (e) {
      console.error('[Battle Result Save Error]', e.message);
    }
  }

  io.to(room.roomCode).emit('battle_finished', {
    leaderboard: room.players.map((p, rank) => ({
      rank: rank + 1,
      userId: p.userId,
      name: p.name,
      score: p.score,
      accuracy: p.accuracy,
      correctCount: p.correctCount,
      wrongCount: p.wrongCount,
      unattemptedCount: p.unattemptedCount
    })),
    questions: room.questions
  });
}

function getFallbackBattleQuestions(count, subject) {
  return [
    {
      _id: 'q_polity_1',
      question: 'Which Article of the Indian Constitution guarantees the Right to Equality before Law?',
      options: ['Article 14', 'Article 19', 'Article 21', 'Article 32'],
      correctAnswer: 0,
      explanation: 'Article 14 guarantees equality before law and equal protection of laws within India.',
      subject: 'Indian Polity',
      topic: 'Fundamental Rights'
    },
    {
      _id: 'q_polity_2',
      question: 'Who is known as the custodian and guardian of the Indian Constitution?',
      options: ['The Prime Minister', 'The President of India', 'The Supreme Court of India', 'The Parliament'],
      correctAnswer: 2,
      explanation: 'The Supreme Court of India acts as the ultimate guardian and custodian of the Constitution.',
      subject: 'Indian Polity',
      topic: 'Supreme Court'
    },
    {
      _id: 'q_hist_1',
      question: 'In which year did the Revolt of 1857 begin from Meerut?',
      options: ['1857', '1856', '1858', '1860'],
      correctAnswer: 0,
      explanation: 'The Revolt began on 10 May 1857 at Meerut as a mutiny of sepoys of the East India Company.',
      subject: 'History',
      topic: 'Revolt of 1857'
    }
  ].slice(0, count);
}
