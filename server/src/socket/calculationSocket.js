/**
 * calculationSocket.js
 *
 * Calculation Arena — real-time 1v1 mental maths speed battle.
 * Runs as a completely separate module from battleSocket.js.
 * Does NOT modify or touch the existing MCQ/QA battle system.
 *
 * Room lifecycle:
 *   LOBBY → IN_PROGRESS → FINISHED
 *
 * Key design decisions:
 *   - Questions are pre-generated server-side (no DB) before the battle starts.
 *   - Both players receive the SAME question sequence (by index), but progress independently.
 *   - Answer validation is O(1): index lookup in the pre-generated array.
 *   - finishCalcBattle() is idempotent (guarded by status check).
 *   - _finishedPayload cached on room for reconnect re-delivery (same session).
 *   - awardUserXP is fire-and-forget, never blocks result delivery.
 */

import { generateQuestionBatch, validateAnswer, ALL_CATEGORIES } from '../services/calcQuestionGenerator.js';
import { awardUserXP } from '../services/gamification.js';

// In-memory rooms (separate namespace from MCQ activeRooms)
const calcRooms = new Map();

// Periodic cleanup: remove finished rooms after 30 min, abandoned after 60 min
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of calcRooms.entries()) {
    const age = now - (room.createdAt || now);
    if (room.status === 'FINISHED' && age > 30 * 60 * 1000) {
      calcRooms.delete(code);
    } else if (age > 60 * 60 * 1000) {
      calcRooms.delete(code);
    }
  }
}, 15 * 60 * 1000);

/** Generate a 6-character uppercase room code */
function genCalcRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return `C${code.slice(0,5)}`; // prefix C to distinguish from MCQ rooms
}

/** Strip the answer from a question before sending to client */
function sanitizeQuestion(q) {
  return { id: q.id, text: q.text, category: q.category, difficulty: q.difficulty };
}

/** Build a sanitized room state safe to send to clients */
function sanitizeCalcRoom(room) {
  return {
    roomCode:    room.roomCode,
    hostId:      room.hostId,
    config:      room.config,
    status:      room.status,
    startTime:   room.startTime,
    endTime:     room.endTime,
    players:     room.players.map(p => ({
      userId:   p.userId,
      name:     p.name,
      correct:  p.correct,
      wrong:    p.wrong,
      attempted: p.attempted,
      currentQIndex: p.currentQIndex,
      finished: !!p.finished,
    })),
  };
}

/**
 * Finish the battle: compute scores, broadcast result, award XP.
 * Idempotent — guarded by status === 'FINISHED' check.
 */
async function finishCalcBattle(room, io) {
  if (room.status === 'FINISHED') return;
  room.status = 'FINISHED';

  if (room._timerTimeout)  { clearTimeout(room._timerTimeout);  room._timerTimeout  = null; }
  if (room._finishTimeout) { clearTimeout(room._finishTimeout); room._finishTimeout = null; }

  // Build leaderboard
  const sorted = [...room.players].sort((a, b) => {
    if (b.correct !== a.correct) return b.correct - a.correct;
    // Tiebreak: fewer wrong answers is better
    return a.wrong - b.wrong;
  });

  const leaderboard = sorted.map((p, idx) => ({
    rank:      idx + 1,
    userId:    p.userId,
    name:      p.name,
    correct:   p.correct,
    wrong:     p.wrong,
    attempted: p.attempted,
    accuracy:  p.attempted > 0 ? parseFloat(((p.correct / p.attempted) * 100).toFixed(2)) : 0,
  }));

  // Determine result
  const isTie = leaderboard.length >= 2 && leaderboard[0].correct === leaderboard[1].correct;
  leaderboard.forEach((e, i) => {
    e.result = isTie ? 'DRAW' : i === 0 ? 'WIN' : 'LOSS';
  });

  const payload = {
    leaderboard,
    config:    room.config,
    startTime: room.startTime,
    endTime:   room.endTime || Date.now(),
  };

  // Cache for reconnect re-delivery (in-memory fast path)
  room._finishedPayload = payload;

  // Broadcast immediately — do NOT await DB saves
  io.to(room.roomCode).emit('calculation_battle_finished', payload);
  console.log(`[Calc] Battle finished: room=${room.roomCode} | ${leaderboard.map(e => `${e.name}=${e.correct}`).join(' vs ')}`);

  // Fire-and-forget XP awards
  (async () => {
    for (let i = 0; i < leaderboard.length; i++) {
      const e = leaderboard[i];
      try {
        const xp = e.result === 'WIN' ? 60 : e.result === 'DRAW' ? 30 : 20;
        const correctBonus = Math.min(e.correct * 5, 100);
        await awardUserXP(e.userId, xp + correctBonus, 'CALC_BATTLE', 'CALC_BATTLE', room.roomCode + '_' + e.userId);
        console.log(`[Calc XP] +${xp + correctBonus} XP to ${e.name} (${e.result})`);
      } catch (err) {
        console.error(`[Calc XP] Failed for ${e.name}: ${err.message}`);
      }
    }
  })();
}

export function initializeCalculationSocket(io) {
  io.on('connection', (socket) => {

    // ── CREATE ROOM ─────────────────────────────────────────────────────────
    socket.on('create_calculation_room', async ({ user, config }, callback) => {
      try {
        if (!user || (!user.id && !user._id)) {
          return callback?.({ success: false, message: 'Unauthorized.' });
        }

        const categories  = (config?.categories?.length ? config.categories : ALL_CATEGORIES);
        const difficulty  = config?.difficulty  || 'medium';
        const durationSec = Number(config?.durationSeconds) || 60;
        const validDurations = [60, 120, 180];
        const mode = config?.mode || 'mixed';
        const duration = validDurations.includes(durationSec) ? durationSec : 60;

        const roomCode = genCalcRoomCode();

        // Pre-generate questions: enough for 3 mins at ~1 q/2s = ~90, generate 200 for safety
        const questions = generateQuestionBatch(categories, difficulty, 200);

        const room = {
          roomCode,
          hostId:   user.id || user._id,
          config: { categories, difficulty, durationSeconds: duration, mode },
          status:   'LOBBY',
          questions,
          players:  [{
            userId:        user.id || user._id,
            name:          user.name,
            socketId:      socket.id,
            correct:       0,
            wrong:         0,
            attempted:     0,
            currentQIndex: 0,
            finished:      false,
          }],
          startTime:  null,
          endTime:    null,
          createdAt:  Date.now(),
          _timerTimeout:  null,
          _finishTimeout: null,
          _finishedPayload: null,
          _answered: new Set(),
        };

        calcRooms.set(roomCode, room);
        socket.join(roomCode);
        console.log(`[Calc] Room created: ${roomCode} by ${user.name} | duration=${duration}s | cats=${categories.join(',')}`);
        callback?.({ success: true, roomCode, room: sanitizeCalcRoom(room) });
      } catch (err) {
        console.error('[Calc] create_calculation_room error:', err.message);
        callback?.({ success: false, message: err.message });
      }
    });

    // ── JOIN ROOM ────────────────────────────────────────────────────────────
    socket.on('join_calculation_room', async ({ roomCode, user }, callback) => {
      try {
        if (!roomCode) return callback?.({ success: false, message: 'Room code required.' });
        const cleanCode = roomCode.trim().toUpperCase();
        const room = calcRooms.get(cleanCode);

        if (!room) {
          return callback?.({ success: false, message: 'Calculation room not found.' });
        }

        const userId = user?.id || user?._id;

        // Reconnect to FINISHED room
        if (room.status === 'FINISHED') {
          if (room._finishedPayload) {
            const isKnown = room.players.some(p => String(p.userId) === String(userId));
            if (isKnown) {
              socket.join(cleanCode);
              socket.emit('calculation_battle_finished', room._finishedPayload);
              return callback?.({ success: true, room: sanitizeCalcRoom(room), alreadyFinished: true });
            }
          }
          return callback?.({ success: false, message: 'Battle has already ended.' });
        }

        // Check capacity
        const existing = room.players.find(p => String(p.userId) === String(userId));
        if (existing) {
          // Reconnecting player
          existing.socketId = socket.id;
          socket.join(cleanCode);
          if (room.status === 'IN_PROGRESS') {
            // Re-sync: send current question index and scores
            socket.emit('calculation_battle_started', {
              startTime: room.startTime,
              endTime:   room.endTime,
              config:    room.config,
            });
            // Send current question
            const q = room.questions[existing.currentQIndex];
            if (q) socket.emit('calculation_question', { question: sanitizeQuestion(q), qIndex: existing.currentQIndex });
          }
          io.to(cleanCode).emit('calculation_room_updated', sanitizeCalcRoom(room));
          return callback?.({ success: true, room: sanitizeCalcRoom(room) });
        }

        // New player
        if (room.players.length >= 2) {
          return callback?.({ success: false, message: 'Room is full (max 2 players).' });
        }
        if (room.status !== 'LOBBY') {
          return callback?.({ success: false, message: 'Battle is already in progress.' });
        }

        room.players.push({
          userId:        userId,
          name:          user.name,
          socketId:      socket.id,
          correct:       0,
          wrong:         0,
          attempted:     0,
          currentQIndex: 0,
          finished:      false,
        });

        socket.join(cleanCode);
        io.to(cleanCode).emit('calculation_room_updated', sanitizeCalcRoom(room));
        console.log(`[Calc] ${user.name} joined room ${cleanCode}`);
        callback?.({ success: true, room: sanitizeCalcRoom(room) });
      } catch (err) {
        console.error('[Calc] join_calculation_room error:', err.message);
        callback?.({ success: false, message: err.message });
      }
    });

    // ── UPDATE ROOM SETTINGS (Host only) ─────────────────────────────────────
    socket.on('calculation_update_settings', async ({ roomCode, userId, config }, callback) => {
      try {
        const cleanCode = (roomCode || '').trim().toUpperCase();
        const room = calcRooms.get(cleanCode);
        if (!room) return callback?.({ success: false, message: 'Room not found.' });

        if (String(room.hostId) !== String(userId)) {
          return callback?.({ success: false, message: 'Only the host can change settings.' });
        }

        if (room.status !== 'LOBBY') {
          return callback?.({ success: false, message: 'Settings can only be changed in the lobby.' });
        }

        const validDurations = [60, 120, 180];
        const validDifficulties = ['easy', 'medium', 'hard', 'expert'];

        if (config?.durationSeconds && validDurations.includes(Number(config.durationSeconds))) {
          room.config.durationSeconds = Number(config.durationSeconds);
        }
        if (config?.difficulty && validDifficulties.includes(config.difficulty)) {
          room.config.difficulty = config.difficulty;
        }
        if (Array.isArray(config?.categories) && config.categories.length > 0) {
          const valid = config.categories.filter(c => ALL_CATEGORIES.includes(c));
          if (valid.length > 0) room.config.categories = valid;
        }
        if (config?.mode && ['mixed', 'topic'].includes(config.mode)) {
          room.config.mode = config.mode;
        }

        const sanitized = sanitizeCalcRoom(room);
        io.to(cleanCode).emit('calculation_settings_updated', { config: room.config });
        io.to(cleanCode).emit('calculation_room_updated', sanitized);

        console.log(`[Calc] Settings updated for room ${cleanCode} by host:`, room.config);
        callback?.({ success: true, config: room.config, room: sanitized });
      } catch (err) {
        console.error('[Calc] calculation_update_settings error:', err.message);
        callback?.({ success: false, message: err.message });
      }
    });

    // ── REMATCH / RETURN TO LOBBY ─────────────────────────────────────────────
    socket.on('calculation_rematch_requested', async ({ roomCode, userId }, callback) => {
      try {
        const cleanCode = (roomCode || '').trim().toUpperCase();
        const room = calcRooms.get(cleanCode);
        if (!room) return callback?.({ success: false, message: 'Room not found.' });

        const player = room.players.find(p => String(p.userId) === String(userId));
        if (!player) return callback?.({ success: false, message: 'Player not in room.' });

        // Clear any lingering timers from previous battle
        if (room._timerTimeout) { clearTimeout(room._timerTimeout); room._timerTimeout = null; }
        if (room._finishTimeout) { clearTimeout(room._finishTimeout); room._finishTimeout = null; }

        // Transition back to LOBBY
        room.status = 'LOBBY';
        room.startTime = null;
        room.endTime = null;
        room._finishedPayload = null;
        room._answered = new Set();

        // Reset player scores and indices
        room.players.forEach(p => {
          p.correct = 0;
          p.wrong = 0;
          p.attempted = 0;
          p.currentQIndex = 0;
          p.finished = false;
        });

        const sanitized = sanitizeCalcRoom(room);
        io.to(cleanCode).emit('calculation_lobby_updated', sanitized);
        io.to(cleanCode).emit('calculation_room_updated', sanitized);

        console.log(`[Calc] Rematch requested by ${player.name} in room ${cleanCode} — returned to LOBBY`);
        callback?.({ success: true, room: sanitized });
      } catch (err) {
        console.error('[Calc] calculation_rematch_requested error:', err.message);
        callback?.({ success: false, message: err.message });
      }
    });

    // ── START BATTLE ─────────────────────────────────────────────────────────
    socket.on('start_calculation_battle', async ({ roomCode, userId }, callback) => {
      try {
        const cleanCode = (roomCode || '').trim().toUpperCase();
        const room = calcRooms.get(cleanCode);
        if (!room) return callback?.({ success: false, message: 'Room not found.' });
        if (String(room.hostId) !== String(userId)) {
          return callback?.({ success: false, message: 'Only the host can start.' });
        }
        if (room.players.length < 1) {
          return callback?.({ success: false, message: 'Need at least 1 player.' });
        }
        if (room.status === 'IN_PROGRESS') {
          // Idempotent: re-broadcast to both room and direct sockets
          const rebcastPayload = { startTime: room.startTime, endTime: room.endTime, config: room.config };
          io.to(cleanCode).emit('calculation_battle_started', rebcastPayload);
          // Re-send directly to each stored socketId as guaranteed fallback
          room.players.forEach(p => {
            const pSocket = io.sockets.sockets.get(p.socketId);
            if (pSocket) {
              pSocket.join(cleanCode);
              pSocket.emit('calculation_battle_started', rebcastPayload);
              const q = room.questions[p.currentQIndex];
              if (q) pSocket.emit('calculation_question', { question: sanitizeQuestion(q), qIndex: p.currentQIndex });
            }
          });
          return callback?.({ success: true, startTime: room.startTime, endTime: room.endTime, config: room.config });
        }
        if (room.status !== 'LOBBY') return callback?.({ success: false, message: 'Invalid state.' });

        // Clear any old timers before starting next battle
        if (room._timerTimeout) { clearTimeout(room._timerTimeout); room._timerTimeout = null; }
        if (room._finishTimeout) { clearTimeout(room._finishTimeout); room._finishTimeout = null; }

        // Generate a FRESH question sequence for this battle/rematch
        room.questions = generateQuestionBatch(room.config.categories, room.config.difficulty, 200);

        // Reset all player counters and indices
        room.players.forEach(p => {
          p.correct = 0;
          p.wrong = 0;
          p.attempted = 0;
          p.currentQIndex = 0;
          p.finished = false;
        });
        room._answered = new Set();
        room._finishedPayload = null;

        const durationMs = room.config.durationSeconds * 1000;
        room.status    = 'IN_PROGRESS';
        room.startTime = Date.now();
        room.endTime   = room.startTime + durationMs;

        const battleStartPayload = {
          startTime: room.startTime,
          endTime:   room.endTime,
          config:    room.config,
        };

        // Broadcast battle_started to all sockets in the Socket.IO room
        io.to(cleanCode).emit('calculation_battle_started', battleStartPayload);

        // ALSO directly emit to each player's stored socketId as a guaranteed fallback.
        // This covers the case where a player's socket reconnected and is no longer
        // a member of the Socket.IO room (io.sockets.sockets membership is lost on reconnect).
        room.players.forEach(p => {
          const pSocket = io.sockets.sockets.get(p.socketId);
          if (pSocket) {
            pSocket.emit('calculation_battle_started', battleStartPayload);
            // Ensure this socket is also joined to the room for future events
            pSocket.join(cleanCode);
          }
        });

        // Send each player their first question
        room.players.forEach(p => {
          const pSocket = io.sockets.sockets.get(p.socketId);
          if (pSocket) {
            const q = room.questions[0];
            if (q) pSocket.emit('calculation_question', { question: sanitizeQuestion(q), qIndex: 0 });
          }
        });

        // Server-side timer: auto-finish when duration expires
        room._timerTimeout = setTimeout(async () => {
          const r = calcRooms.get(cleanCode);
          if (r && r.status === 'IN_PROGRESS') {
            console.log(`[Calc] Timer expired for room ${cleanCode} — finishing`);
            await finishCalcBattle(r, io);
          }
        }, durationMs + 2000); // 2s grace

        console.log(`[Calc] Battle started: room=${cleanCode} | players=${room.players.map(p=>p.name).join(' vs ')} | duration=${room.config.durationSeconds}s`);
        callback?.({ success: true, startTime: room.startTime, endTime: room.endTime, config: room.config });
      } catch (err) {
        console.error('[Calc] start_calculation_battle error:', err.message);
        callback?.({ success: false, message: err.message });
      }
    });

    // ── SUBMIT ANSWER ────────────────────────────────────────────────────────
    // Most performance-critical handler — must be O(1).
    socket.on('submit_calculation_answer', async ({ roomCode, userId, qIndex, answer }, callback) => {
      const t0 = Date.now();
      try {
        const cleanCode = (roomCode || '').trim().toUpperCase();
        const room = calcRooms.get(cleanCode);

        if (!room || room.status !== 'IN_PROGRESS') {
          return callback?.({ correct: false, reason: 'not_active' });
        }

        // Reject answers submitted after time expiry
        if (Date.now() > room.endTime) {
          return callback?.({ correct: false, reason: 'time_expired' });
        }

        const player = room.players.find(p => String(p.userId) === String(userId));
        if (!player) return callback?.({ correct: false, reason: 'player_not_found' });

        // Self-healing socketId
        if (player.socketId !== socket.id) player.socketId = socket.id;

        // Reject if question index doesn't match player's current position
        if (qIndex !== player.currentQIndex) {
          return callback?.({ correct: false, reason: 'wrong_question', expected: player.currentQIndex });
        }

        // Prevent double-scoring: guard by checking _answered flag
        const qKey = `${player.userId}_${qIndex}`;
        if (room._answered?.has(qKey)) {
          return callback?.({ correct: false, reason: 'duplicate' });
        }

        const question = room.questions[qIndex];
        if (!question) return callback?.({ correct: false, reason: 'question_not_found' });

        const { correct } = validateAnswer(answer, question.answer);

        const latencyMs = Date.now() - t0;

        if (correct) {
          // Mark as answered to prevent double-scoring
          if (!room._answered) room._answered = new Set();
          room._answered.add(qKey);

          player.correct++;
          player.attempted++;
          player.currentQIndex++;

          // Send next question to this player
          const nextQ = room.questions[player.currentQIndex];
          callback?.({
            correct:    true,
            latencyMs,
            nextQuestion: nextQ ? sanitizeQuestion(nextQ) : null,
            nextQIndex:   player.currentQIndex,
            playerScore: { correct: player.correct, wrong: player.wrong, attempted: player.attempted },
          });

          // Broadcast updated scores to both players
          io.to(cleanCode).emit('calculation_scores_updated', {
            players: room.players.map(p => ({
              userId:   p.userId,
              name:     p.name,
              correct:  p.correct,
              wrong:    p.wrong,
              attempted:p.attempted,
            })),
          });
        } else {
          player.wrong++;
          player.attempted++;

          callback?.({
            correct:   false,
            latencyMs,
            expected:  question.answer, // reveal answer on wrong (optional — can remove)
            playerScore: { correct: player.correct, wrong: player.wrong, attempted: player.attempted },
          });

          // Also update wrong count for opponent's view
          io.to(cleanCode).emit('calculation_scores_updated', {
            players: room.players.map(p => ({
              userId:   p.userId,
              name:     p.name,
              correct:  p.correct,
              wrong:    p.wrong,
              attempted:p.attempted,
            })),
          });
        }

        console.log(`[Calc] Answer: room=${cleanCode} user=${userId} q=${qIndex} correct=${correct} latency=${latencyMs}ms`);
      } catch (err) {
        console.error('[Calc] submit_calculation_answer error:', err.message);
        callback?.({ correct: false, reason: 'server_error' });
      }
    });

    // ── PLAYER SIGNALS THEY ARE DONE (early finish) ──────────────────────────
    socket.on('calculation_player_finished', async ({ roomCode, userId }) => {
      const cleanCode = (roomCode || '').trim().toUpperCase();
      const room = calcRooms.get(cleanCode);
      if (!room || room.status !== 'IN_PROGRESS') return;

      const player = room.players.find(p => String(p.userId) === String(userId));
      if (!player || player.finished) return;
      player.finished = true;

      const allDone = room.players.every(p => p.finished);
      if (allDone || room.players.length === 1) {
        await finishCalcBattle(room, io);
      } else if (!room._finishTimeout) {
        // Give other player 60 extra seconds then force finish
        room._finishTimeout = setTimeout(async () => {
          const r = calcRooms.get(cleanCode);
          if (r && r.status === 'IN_PROGRESS') await finishCalcBattle(r, io);
        }, 60 * 1000);
      }
    });

    // ── LEAVE ROOM ───────────────────────────────────────────────────────────
    socket.on('leave_calculation_room', ({ roomCode, userId }) => {
      const cleanCode = (roomCode || '').trim().toUpperCase();
      const room = calcRooms.get(cleanCode);
      if (!room) return;
      room.players = room.players.filter(p => String(p.userId) !== String(userId));
      if (room.players.length === 0) {
        if (room._timerTimeout) { clearTimeout(room._timerTimeout); room._timerTimeout = null; }
        if (room._finishTimeout) { clearTimeout(room._finishTimeout); room._finishTimeout = null; }
        calcRooms.delete(cleanCode);
      } else {
        if (String(room.hostId) === String(userId)) room.hostId = room.players[0].userId;
        io.to(cleanCode).emit('calculation_room_updated', sanitizeCalcRoom(room));
      }
    });

    // ── RECONNECT ────────────────────────────────────────────────────────────
    socket.on('reconnect', () => {
      // Client should re-emit join_calculation_room to re-sync
    });

    socket.on('disconnect', () => {
      // On disconnect, leave the room (socket.io handles socket.leave automatically)
    });
  });
}
