import { Question } from '../models/Question.js';
import { TestAttempt } from '../models/TestAttempt.js';
import { awardUserXP } from '../services/gamification.js';
import { scoreShortAnswer } from '../services/proximityScorer.js';

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
          createdAt: Date.now(),
          _customQuestions: true  // rematch keeps original questions
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

    // Create Room with pre-supplied questions (from newly generated test — no DB save required)
    socket.on('create_room_with_questions', async ({ user, config, questions }, callback) => {
      try {
        if (!user || (!user.id && !user._id)) {
          if (typeof callback === 'function') callback({ success: false, message: 'Unauthorized.' });
          return;
        }
        if (!Array.isArray(questions) || questions.length === 0) {
          if (typeof callback === 'function') callback({ success: false, message: 'No questions provided.' });
          return;
        }

        const roomCode = generateRoomCode();
        const roomState = {
          roomId: roomCode,
          roomCode,
          hostId: user.id || user._id,
          config: {
            subject: config?.subject || 'Custom Test',
            topic: config?.topic || 'General',
            questionCount: questions.length,
            timeLimitMinutes: config?.timeLimitMinutes || 10,
            negativeMarking: config?.negativeMarking ?? 0.25,
            difficulty: config?.difficulty || 'Mixed'
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
          createdAt: Date.now(),
          _customQuestions: true  // rematch keeps original questions
        };

        activeRooms.set(roomCode, roomState);
        socket.join(roomCode);
        if (typeof callback === 'function') callback({ success: true, roomCode, room: roomState });
      } catch (err) {
        if (typeof callback === 'function') callback({ success: false, message: err.message });
      }
    });

    // Create Room from a Saved Test (fetches questions from DB)
    socket.on('create_room_from_saved_test', async ({ user, savedTestId, config }, callback) => {
      try {
        if (!user || (!user.id && !user._id)) {
          if (typeof callback === 'function') callback({ success: false, message: 'Unauthorized.' });
          return;
        }

        // Import SavedTest model dynamically to avoid circular deps
        const { SavedTest } = await import('../models/SavedTest.js');
        const savedTest = await SavedTest.findById(savedTestId);
        if (!savedTest) {
          if (typeof callback === 'function') callback({ success: false, message: 'Saved test not found.' });
          return;
        }

        // Ownership check
        const requestUserId = String(user.id || user._id);
        if (savedTest.userId !== requestUserId) {
          if (typeof callback === 'function') callback({ success: false, message: 'Access denied to this saved test.' });
          return;
        }

        const allQuestions = savedTest.questions;
        if (!allQuestions || allQuestions.length === 0) {
          if (typeof callback === 'function') callback({ success: false, message: 'Saved test has no questions.' });
          return;
        }

        // ── Random Question Sampling (Fisher-Yates) ──────────────────────────
        // Determine how many questions the host wants. Defaults to all.
        const requestedCount = config?.questionCount
          ? Math.min(Math.max(parseInt(config.questionCount, 10) || allQuestions.length, 1), allQuestions.length)
          : allQuestions.length;

        // Validate: cannot request more than available
        if (config?.questionCount && parseInt(config.questionCount, 10) > allQuestions.length) {
          if (typeof callback === 'function') callback({
            success: false,
            message: `Only ${allQuestions.length} questions available. Please select ${allQuestions.length} or fewer.`
          });
          return;
        }

        // Fisher-Yates shuffle on a shallow copy of the array, then slice
        const pool = allQuestions.map((q, i) => i); // array of indices
        for (let i = pool.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [pool[i], pool[j]] = [pool[j], pool[i]];
        }
        const selectedIndices = pool.slice(0, requestedCount);
        const questions = selectedIndices.map(idx => allQuestions[idx]);

        console.log(`[Battle] Room from saved test: ${allQuestions.length} total → ${questions.length} selected (random).`);

        const roomCode = generateRoomCode();
        const roomState = {
          roomId: roomCode,
          roomCode,
          hostId: requestUserId,
          config: {
            subject: savedTest.subject || 'Custom Test',
            topic: savedTest.topic || 'General',
            questionCount: questions.length,
            timeLimitMinutes: config?.timeLimitMinutes || Math.max(5, Math.ceil(questions.length * 1.5)),
            negativeMarking: config?.negativeMarking ?? 0.25,
            difficulty: savedTest.difficulty || 'Mixed',
            totalAvailable: allQuestions.length,  // for lobby display
          },
          status: 'LOBBY',
          questions,
          players: [{
            userId: requestUserId,
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
          createdAt: Date.now(),
          _customQuestions: true  // rematch keeps already-selected questions (no reshuffle)
        };

        activeRooms.set(roomCode, roomState);
        socket.join(roomCode);
        if (typeof callback === 'function') callback({ success: true, roomCode, room: roomState, testTitle: savedTest.title });
      } catch (err) {
        console.error('[Socket] create_room_from_saved_test error:', err.message);
        if (typeof callback === 'function') callback({ success: false, message: err.message });
      }
    });

    // Join Room
    socket.on('join_room', ({ roomCode, user }, callback) => {
      if (!roomCode) return;
      const cleanCode = roomCode.trim().toUpperCase();
      const room = activeRooms.get(cleanCode);
      console.log(`[Battle] join_room: code=${cleanCode}, userId=${user?.id || user?._id}, socketId=${socket.id}, roomStatus=${room?.status}`);

      if (!room) {
        console.warn(`[Battle] join_room failed: room ${cleanCode} not found`);
        if (typeof callback === 'function') callback({ success: false, message: 'Battle Room not found. Check room code.' });
        return;
      }

      if (room.status === 'FINISHED') {
        // ── RECONNECT FIX: re-deliver results to a player whose socket dropped after finish ──
        // Root cause of "stuck on Waiting" in production:
        //   1. finishBattle() emits battle_finished to the room (old socket IDs).
        //   2. One player's Render WebSocket drops immediately after submission.
        //   3. The client reconnects and calls join_room with a new socket ID.
        //   4. Old code returned { success: false } here — new socket never got battle_finished.
        //   5. Player stuck on "Exam Submitted! Waiting…" forever.
        // Fix: re-emit battle_finished directly to this socket if results are cached.
        const userId = user?.id || user?._id;
        console.log(`[Battle] join_room: room ${cleanCode} is FINISHED — checking if ${userId} is a player to re-send results`);
        const isKnownPlayer = room.players.some(p => String(p.userId) === String(userId));
        if (isKnownPlayer && room._finishedPayload) {
          socket.join(cleanCode);
          console.log(`[Battle] join_room: re-sending battle_finished to reconnected player ${userId} (socket ${socket.id})`);
          socket.emit('battle_finished', room._finishedPayload);
          if (typeof callback === 'function') callback({ success: true, room: sanitizeRoomState(room), alreadyFinished: true });
        } else {
          if (typeof callback === 'function') callback({ success: false, message: 'Battle has already ended.' });
        }
        return;
      }

      const userId = user?.id || user?._id;
      let existingPlayer = room.players.find(p => p.userId === userId);
      if (existingPlayer) {
        console.log(`[Battle] join_room: reconnecting player ${userId}, updating socketId ${existingPlayer.socketId} → ${socket.id}`);
        existingPlayer.socketId = socket.id;
      } else {
        // ENFORCE MAX CAPACITY: 3 PLAYERS MAXIMUM
        if (room.players.length >= 3) {
          if (typeof callback === 'function') callback({ success: false, message: 'Room is full (Max 3 players).' });
          return;
        }
        console.log(`[Battle] join_room: new player ${userId} joining room ${cleanCode}`);
        room.players.push({
          userId,
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

      // During LOBBY: broadcast room_updated to ALL so everyone sees the new player list.
      // During IN_PROGRESS: only send to the reconnecting socket — broadcasting to the whole
      // room replaces other players' roomState with a sanitized payload that has no questions
      // field, which breaks their handleFinishBattle and causes answers to be lost.
      if (room.status === 'IN_PROGRESS') {
        socket.emit('room_updated', sanitizeRoomState(room));
      } else {
        io.to(room.roomCode).emit('room_updated', sanitizeRoomState(room));
      }

      // ── CRITICAL: If the room is already IN_PROGRESS, sync this socket immediately ──
      // This handles reconnects and late-joins during an active battle.
      // Emit battle_started only to this socket (not the whole room) so other
      // players are not disrupted.
      if (room.status === 'IN_PROGRESS') {
        console.log(`[Battle] join_room: room ${cleanCode} is IN_PROGRESS — syncing socket ${socket.id} with battle_started`);
        socket.emit('battle_started', {
          status: 'IN_PROGRESS',
          startTime: room.startTime,
          endTime: room.endTime,
          questions: room.questions.map(q => ({
            _id: q._id,
            question: q.question,
            options: q.options,
            questionType: q.questionType || 'mcq',
            subject: q.subject,
            topic: q.topic,
            difficulty: q.difficulty
            // correctAnswer, referenceAnswer, explanation intentionally stripped
          }))
        });
      }

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
      const cleanCode = (roomCode || '').trim().toUpperCase();
      console.log(`[Battle] Host start request received: room=${cleanCode}, userId=${userId}, socketId=${socket.id}`);

      const room = activeRooms.get(cleanCode);
      if (!room) {
        console.warn(`[Battle] start_battle failed: room ${cleanCode} not found (server may have restarted)`);
        if (typeof callback === 'function') callback({ success: false, message: 'Room not found. The server may have restarted — please create a new room.' });
        return;
      }

      console.log(`[Battle] Host validation: room.hostId=${room.hostId}, userId=${userId}, status=${room.status}, players=${room.players.length}`);

      // Idempotent: if already IN_PROGRESS, re-broadcast so reconnected players can catch up
      if (room.status === 'IN_PROGRESS') {
        console.log(`[Battle] room ${cleanCode} already IN_PROGRESS — re-emitting battle_started`);
        io.to(cleanCode).emit('battle_started', {
          status: 'IN_PROGRESS',
          startTime: room.startTime,
          endTime: room.endTime,
          questions: room.questions.map(q => ({
            _id: q._id,
            question: q.question,
            options: q.options,
            questionType: q.questionType || 'mcq',
            subject: q.subject,
            topic: q.topic,
            difficulty: q.difficulty
          }))
        });
        if (typeof callback === 'function') callback({ success: true });
        return;
      }

      // Compare as strings to avoid type mismatch (ObjectId vs string)
      if (String(room.hostId) !== String(userId)) {
        console.warn(`[Battle] Host validation result: REJECTED — room.hostId=${room.hostId} !== userId=${userId}`);
        if (typeof callback === 'function') callback({ success: false, message: 'Only the host can start the battle.' });
        return;
      }

      const durationMs = room.config.timeLimitMinutes * 60 * 1000;
      room.status = 'IN_PROGRESS';
      room.startTime = Date.now();
      room.endTime = room.startTime + durationMs;

      console.log(`[Battle] Room status changed to ACTIVE (IN_PROGRESS): room=${cleanCode}, players=${room.players.length}, questions=${room.questions.length}, timeLimitMinutes=${room.config.timeLimitMinutes}`);

      // Auto-finish when timer expires (server-side safety net)
      room._timerTimeout = setTimeout(async () => {
        const currentRoom = activeRooms.get(cleanCode);
        if (currentRoom && currentRoom.status === 'IN_PROGRESS') {
          console.log(`[Battle] Timer expired for room ${cleanCode} — auto-finishing`);
          await finishBattle(currentRoom, io);
        }
      }, durationMs + 5000); // 5s grace period after timer

      // SECURITY: Strip correct answers and explanations before starting live battle
      const battlePayload = {
        status: 'IN_PROGRESS',
        startTime: room.startTime,
        endTime: room.endTime,
        questions: room.questions.map(q => ({
          _id: q._id,
          question: q.question,
          options: q.options,
          questionType: q.questionType || 'mcq',
          subject: q.subject,
          topic: q.topic,
          difficulty: q.difficulty
          // correctAnswer, referenceAnswer, explanation intentionally stripped
        }))
      };

      console.log(`[Battle] battle_started broadcast to room ${cleanCode}: ${room.players.length} players`);
      room.players.forEach(p => {
        console.log(`[Battle]   → ${p.name} (userId=${p.userId}, socketId=${p.socketId})`);
      });

      // Broadcast to entire Socket.IO room (reaches guests)
      io.to(cleanCode).emit('battle_started', battlePayload);

      // Also include battlePayload in the ack so the HOST can apply it directly.
      // This guarantees the host transitions to IN_PROGRESS even if its socket
      // is not in the Socket.IO room at broadcast time (e.g. after a Render reconnect).
      if (typeof callback === 'function') callback({ success: true, ...battlePayload });
    });

    // Submit Answer for a Question (Live status update WITHOUT leaking chosen option)
    socket.on('submit_answer', async ({ roomCode, userId, questionIndex, selectedOptionIndex }) => {
      const cleanCode = roomCode.trim().toUpperCase();
      const room = activeRooms.get(cleanCode);
      if (!room || room.status !== 'IN_PROGRESS') return;

      const player = room.players.find(p => p.userId === userId);
      if (!player) return;

      // Self-healing socketId: if the player's socket reconnected since room creation,
      // the stored socketId may be stale. Update it rather than silently dropping the answer.
      // Root cause: submit_answer was previously blocked on reconnect, causing all answers
      // to be lost and all questions to be scored as skipped.
      if (player.socketId !== socket.id) {
        console.log(`[Battle] submit_answer: socketId mismatch for userId=${userId} — healing: ${player.socketId} → ${socket.id}`);
        player.socketId = socket.id;
      }

      const question = room.questions[questionIndex];
      if (!question) return;

      // Allow answer override (player can change answer before submitting final)
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
        console.log(`[Battle] All players answered all questions in room ${room.roomCode} — auto-finishing`);
        await finishBattle(room, io);
      }
    });

    // Manual Finish Request (host only — others cannot force-end the room)
    socket.on('finish_battle_early', async ({ roomCode, userId }) => {
      const cleanCode = roomCode.trim().toUpperCase();
      const room = activeRooms.get(cleanCode);
      if (!room || room.status !== 'IN_PROGRESS') return;

      // SECURITY: Only the host may force-end a battle early
      if (room.hostId !== userId) {
        console.warn(`[Socket Security] finish_battle_early blocked: userId=${userId} is not the host of room ${cleanCode}`);
        return;
      }

      await finishBattle(room, io);
    });

    // Player clicked "Submit Exam" — mark them done, finish if all done (or immediately for solo)
    socket.on('player_finished', async ({ roomCode, userId }) => {
      const cleanCode = roomCode?.trim().toUpperCase();
      if (!cleanCode) return;
      const room = activeRooms.get(cleanCode);

      console.log(`[Battle] player_finished received: room=${cleanCode}, userId=${userId}, socketId=${socket.id}, roomStatus=${room?.status}`);

      if (!room || room.status !== 'IN_PROGRESS') {
        console.warn(`[Battle] player_finished: ignoring — room ${cleanCode} not found or status=${room?.status}`);
        return;
      }

      const player = room.players.find(p => p.userId === userId);
      if (!player) {
        console.warn(`[Battle] player_finished: userId=${userId} not found in room ${cleanCode}. Players: [${room.players.map(p => p.userId).join(', ')}]`);
        return;
      }

      // Self-healing socketId: if the player's socket reconnected between room creation and
      // this submission, the stored socketId is stale. Update it instead of silently blocking.
      // This was the PRIMARY cause of "both players stuck on SUBMITTING" — the socketId check
      // was an overly strict security gate that fired on every Render WebSocket reconnect.
      if (player.socketId !== socket.id) {
        console.log(`[Battle] player_finished: socketId mismatch for userId=${userId} — healing: ${player.socketId} → ${socket.id}`);
        player.socketId = socket.id;
      }

      if (player.finished) {
        console.log(`[Battle] player_finished: ${userId} already marked finished in room ${cleanCode} — ignoring duplicate`);
        return;
      }

      player.finished = true;
      const finishedCount = room.players.filter(p => p.finished).length;
      console.log(`[Battle] Player completion state updated: ${player.name} (${userId}) in room ${cleanCode}. Finished: ${finishedCount}/${room.players.length}`);
      console.log(`[Battle] All players completion status:`);
      room.players.forEach(p => {
        console.log(`[Battle]   ${p.name} (${p.userId}): finished=${!!p.finished}, answers=${Object.keys(p.answers).length}/${room.questions.length}`);
      });

      // If all players have finished, or only 1 player in room → end immediately
      const allDone = room.players.every(p => p.finished);
      if (allDone || room.players.length === 1) {
        console.log(`[Battle] All players done in room ${cleanCode} — calling finishBattle`);
        await finishBattle(room, io);
      } else {
        // Notify others that this player finished
        io.to(cleanCode).emit('player_status_changed', {
          userId,
          questionIndex: -1,
          players: room.players.map(p => ({
            userId: p.userId,
            name: p.name,
            finished: !!p.finished,
            totalSubmitted: Object.keys(p.answers).length
          }))
        });

        // ── TIMEOUT: If other player(s) haven't finished within 60 seconds, force-finish ──
        // Reduced from 5 minutes: the frontend safety net shows an error at 30s and users
        // stop waiting. 60s gives enough time for slow connections while still being timely.
        if (!room._finishTimeout) {
          console.log(`[Battle] Starting 60s force-finish timer for room ${cleanCode}`);
          room._finishTimeout = setTimeout(async () => {
            const currentRoom = activeRooms.get(cleanCode);
            if (currentRoom && currentRoom.status === 'IN_PROGRESS') {
              console.log(`[Battle] 60s timeout reached — force-finishing room ${cleanCode}`);
              await finishBattle(currentRoom, io);
            }
          }, 60 * 1000); // 60 seconds (was 5 minutes — too long vs 30s frontend safety net)
        }
      }
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
        p.finished = false;
      });

      // Only replace questions with fresh DB questions if this was a standard room
      // (not a custom/saved-test room). Custom rooms keep their original questions on rematch.
      const isCustomRoom = room._customQuestions === true;
      if (!isCustomRoom) {
        const availableForRematch = await Question.countDocuments({ subject: room.config.subject, status: 'PUBLISHED' });
        if (availableForRematch > 0) {
          const freshQuestions = await Question.aggregate([
            { $match: { subject: room.config.subject, status: 'PUBLISHED' } },
            { $sample: { size: Math.min(room.config.questionCount, availableForRematch) } }
          ]);
          if (freshQuestions && freshQuestions.length > 0) {
            room.questions = freshQuestions;
            room.config.questionCount = freshQuestions.length;
          }
        }
      }
      // Custom/saved-test rooms: reset player scores but keep the same questions

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
  // ── Guard against double-invocation (timer + player_finished race) ──────────
  console.log(`[Battle] finishBattle guard check: room=${room.roomCode}, status=${room.status}`);
  if (room.status === 'FINISHED') {
    console.log(`[Battle] finishBattle: room ${room.roomCode} already FINISHED — skipping`);
    return;
  }
  room.status = 'FINISHED';

  // Clear any pending timeouts so they don't trigger a second finishBattle
  if (room._timerTimeout) { clearTimeout(room._timerTimeout); room._timerTimeout = null; }
  if (room._finishTimeout) { clearTimeout(room._finishTimeout); room._finishTimeout = null; }

  console.log(`[Battle] finishBattle invoked: room=${room.roomCode}, players=${room.players.length}, questions=${room.questions.length}`);
  console.log(`[Battle] Scoring started`);

  room.players.forEach(p => {
    let correct = 0;
    let partial = 0;
    let wrong   = 0;
    let score   = 0;
    const answerScores = {}; // { questionIndex: 0-100 } for short-answer questions

    room.questions.forEach((q, idx) => {
      const selected = p.answers[idx];

      // ── Short-answer: proximity scoring ─────────────────────────────────
      if (q.questionType === 'short_answer') {
        const hasAnswer = selected !== undefined && selected !== null &&
                          selected !== '' && selected !== -1;
        if (!hasAnswer) {
          answerScores[idx] = 0;
          return; // unattempted — no penalty, no reward
        }
        const { score: pct } = scoreShortAnswer(String(selected), q.referenceAnswer || '');
        answerScores[idx] = pct;

        // Contribution: pct/100 points (max 1, same weight as MCQ correct)
        score += pct / 100;
        if (pct === 100)      correct++;
        else if (pct > 0)     partial++;
        else                  wrong++;
        return;
      }

      // ── MCQ: existing exact scoring ──────────────────────────────────────
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

    const attempted = correct + partial + wrong;
    const unattempted = room.questions.length - attempted;
    p.correctCount    = correct;
    p.partialCount    = partial;
    p.wrongCount      = wrong;
    p.unattemptedCount = unattempted;
    p.score           = Math.max(0, parseFloat(score.toFixed(2)));
    p.accuracy        = room.questions.length > 0
      ? Math.round(Math.max(0, score) / room.questions.length * 100)
      : 0;
    p.answerScores    = answerScores;
  });

  room.players.sort((a, b) => b.score - a.score);

  console.log(`[Battle] Scoring completed. Leaderboard:`);
  room.players.forEach((p, i) => {
    console.log(`[Battle]   #${i+1} ${p.name}: score=${p.score}, correct=${p.correctCount}, partial=${p.partialCount||0}, wrong=${p.wrongCount}, skipped=${p.unattemptedCount}`);
  });

  // ── BROADCAST RESULTS FIRST ──────────────────────────────────────────
  // CRITICAL FIX: The battle_finished broadcast must happen IMMEDIATELY after
  // scoring. DB saves (TestAttempt.create, awardUserXP) are best-effort and run
  // in the background AFTER the broadcast. A hung DB call must NEVER block results.

  const leaderboard = room.players.map((p, rank) => ({
    rank: rank + 1,
    userId: p.userId,
    name: p.name,
    score: p.score,
    accuracy: p.accuracy,
    correctCount: p.correctCount,
    partialCount: p.partialCount || 0,
    wrongCount: p.wrongCount,
    unattemptedCount: p.unattemptedCount,
    answerScores: p.answerScores || {},
    // Include submitted answers so ALL players can see comparative review
    submittedAnswers: p.answers || {},
  }));

  console.log(`[Battle] Leaderboard generated. battle_finished broadcast started to room ${room.roomCode}`);
  room.players.forEach(p => {
    console.log(`[Battle]   → ${p.name} (socketId=${p.socketId})`);
  });

  // Broadcast results to all players immediately
  io.to(room.roomCode).emit('battle_finished', {
    leaderboard,
    questions: room.questions   // includes referenceAnswer — revealed only after finish
  });

  // ── RECONNECT FIX: cache the finished payload so join_room can re-deliver it ──
  // If a player's WebSocket dropped at the exact moment of broadcast (common on Render
  // free tier), they reconnect with a new socket ID and call join_room. We re-send
  // battle_finished from join_room using this cached payload.
  room._finishedPayload = {
    leaderboard,
    questions: room.questions
  };

  console.log(`[Battle] battle_finished broadcast completed for room ${room.roomCode}: ${room.players.map(p => `${p.name}=${p.score}pts`).join(', ')}`);

  // ── Save to DB in the background (non-blocking) ──────────────────────────────────
  // Results are already broadcast above. DB saves happen after — if they fail or
  // hang, it does NOT affect the results already delivered to both players.
  const withTimeout = (promise, ms, label) => Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    )
  ]);

  // Fire-and-forget: do not await this block
  (async () => {
    for (let i = 0; i < room.players.length; i++) {
      const p = room.players[i];
      try {
        await withTimeout(
          TestAttempt.create({
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
          }),
          8000,
          'TestAttempt.create'
        );

        const bonusXp = i === 0 ? 50 : 20;
        await withTimeout(
          awardUserXP(p.userId, (p.correctCount * 10) + Math.round((p.partialCount || 0) * 5) + bonusXp),
          8000,
          'awardUserXP'
        );
        console.log(`[Battle DB] Saved result for ${p.name} (rank ${i + 1})`);
      } catch (e) {
        console.error(`[Battle Result Save Error] player=${p.name} (${p.userId}): ${e.message}`);
        // Non-fatal: results already broadcast above
      }
    }
    console.log(`[Battle DB] Background save complete for room ${room.roomCode}`);
  })();
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
