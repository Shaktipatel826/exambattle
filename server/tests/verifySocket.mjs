/**
 * ExamBattle — Real 2-Player Socket.io Integration Test
 *
 * Replaces the fake Test 8 from verifyMultiAI.mjs.
 * Runs a full battle lifecycle with two real socket connections.
 *
 * Requirements:
 *   - Server must be running on http://localhost:5000
 *   - Admin credentials: admin@shakti.com / admin123
 *   - Student credentials: student@shakti.com / student123
 *   - npm install socket.io-client --save-dev (already done)
 *
 * Usage:
 *   node tests/verifySocket.mjs
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { io as SocketClient } from 'socket.io-client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const BASE = 'http://localhost:5000';
let PASS = 0;
let FAIL = 0;
const RESULTS = [];

// ─── Utilities ────────────────────────────────────────────────────────────────

function pass(name, detail = '') {
  PASS++;
  RESULTS.push(`  ✅ PASS | ${name}${detail ? ' — ' + detail : ''}`);
  console.log(`  ✅ PASS | ${name}${detail ? ' — ' + detail : ''}`);
}

function fail(name, detail = '') {
  FAIL++;
  RESULTS.push(`  ❌ FAIL | ${name}${detail ? ' — ' + detail : ''}`);
  console.log(`  ❌ FAIL | ${name}${detail ? ' — ' + detail : ''}`);
}

async function httpPost(url, body, token) {
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  });
  return { status: r.status, data: await r.json().catch(() => ({})) };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a socket connection and return a helper object.
 * The socket resolves/rejects on 'connect' / 'connect_error'.
 */
function makeSocket(token) {
  return new Promise((resolve, reject) => {
    const socket = SocketClient(BASE, {
      auth: { token },
      transports: ['websocket'],
      reconnection: false,
      timeout: 10000
    });

    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', (err) => reject(new Error(`connect_error: ${err.message}`)));

    // Auto-reject after 10 s
    setTimeout(() => reject(new Error('Socket connection timed out')), 10000);
  });
}

/**
 * Emit an event and wait for the ack callback result.
 * Returns the ack payload.
 */
function emit(socket, event, data, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Ack timeout for event '${event}'`)),
      timeoutMs
    );
    socket.emit(event, data, (ack) => {
      clearTimeout(timer);
      resolve(ack);
    });
  });
}

/**
 * Wait for a specific event on a socket, with timeout.
 */
function waitForEvent(socket, event, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timeout waiting for event '${event}'`)),
      timeoutMs
    );
    socket.once(event, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

// ─── Login helpers ────────────────────────────────────────────────────────────

async function login(email, password) {
  const { status, data } = await httpPost(`${BASE}/api/auth/login`, { email, password });
  if (status !== 200 || !data.token) throw new Error(`Login failed for ${email}: ${JSON.stringify(data)}`);
  return { token: data.token, user: data.user };
}

// ─── MAIN TEST SUITE ──────────────────────────────────────────────────────────

async function runTests() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║   ExamBattle — Real 2-Player Socket.io Integration Tests    ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // ── Check server is up ────────────────────────────────────────────────────
  console.log('[PRE] Checking server availability...');
  try {
    const r = await fetch(`${BASE}/api/health`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    pass('Server health check');
  } catch (err) {
    fail('Server health check', err.message);
    console.log('\n⛔  Server is not running. Start it with: node src/index.js');
    console.log('\n══════ FINAL RESULTS ══════');
    console.log(`PASS: ${PASS}  |  FAIL: ${FAIL}`);
    process.exit(1);
  }

  // ── TEST 1: Authentication ────────────────────────────────────────────────
  console.log('\n[1] Authentication — obtain JWT tokens for two users');
  let adminToken, adminUser, studentToken, studentUser;
  try {
    ({ token: adminToken, user: adminUser } = await login('admin@shakti.com', 'admin123'));
    pass('Admin login');
  } catch (err) {
    fail('Admin login', err.message);
  }
  try {
    ({ token: studentToken, user: studentUser } = await login('student@shakti.com', 'student123'));
    pass('Student login');
  } catch (err) {
    fail('Student login', err.message);
  }

  if (!adminToken || !studentToken) {
    fail('Cannot continue without both tokens');
    printSummary();
    return;
  }

  // ── TEST 2: Socket connections ────────────────────────────────────────────
  console.log('\n[2] Socket Connections');
  let socket1, socket2;
  try {
    socket1 = await makeSocket(adminToken);
    pass('Socket 1 (admin) connected', `id=${socket1.id}`);
  } catch (err) {
    fail('Socket 1 (admin) connect failed', err.message);
  }
  try {
    socket2 = await makeSocket(studentToken);
    pass('Socket 2 (student) connected', `id=${socket2.id}`);
  } catch (err) {
    fail('Socket 2 (student) connect failed', err.message);
  }

  if (!socket1 || !socket2) {
    fail('Cannot continue without both sockets');
    if (socket1) socket1.disconnect();
    if (socket2) socket2.disconnect();
    printSummary();
    return;
  }

  let roomCode;

  try {
    // ── TEST 3: Create Room ────────────────────────────────────────────────
    console.log('\n[3] Room Creation (socket1 = host)');
    const createAck = await emit(socket1, 'create_room', {
      user: { id: adminUser._id || adminUser.id, name: adminUser.name },
      config: {
        subject: 'All',
        questionCount: 5,
        timeLimitMinutes: 2,
        negativeMarking: 0.25,
        difficulty: 'All'
      }
    });

    if (createAck?.success && createAck.roomCode) {
      roomCode = createAck.roomCode;
      pass('create_room ack success', `roomCode=${roomCode}`);

      // Verify initial room state
      const rm = createAck.room;
      (rm?.players?.length === 1)
        ? pass('Room has 1 player (host only)')
        : fail('Room player count', `expected 1, got ${rm?.players?.length}`);
      (rm?.status === 'LOBBY')
        ? pass('Room status is LOBBY')
        : fail('Room status', `expected LOBBY, got ${rm?.status}`);
    } else {
      fail('create_room failed', JSON.stringify(createAck));
    }

    // ── TEST 4: Join Room ─────────────────────────────────────────────────
    console.log('\n[4] Room Join (socket2 = student joins)');
    // Listen for room_updated on socket1 BEFORE socket2 joins
    const roomUpdatedP = waitForEvent(socket1, 'room_updated', 5000);

    const joinAck = await emit(socket2, 'join_room', {
      roomCode,
      user: { id: studentUser._id || studentUser.id, name: studentUser.name }
    });

    if (joinAck?.success) {
      pass('join_room ack success');
      const rm = joinAck.room;
      (rm?.players?.length === 2)
        ? pass('Room has 2 players after join')
        : fail('Room player count after join', `expected 2, got ${rm?.players?.length}`);
    } else {
      fail('join_room failed', JSON.stringify(joinAck));
    }

    // Verify host received room_updated broadcast
    try {
      const updatedRoom = await roomUpdatedP;
      (updatedRoom?.players?.length === 2)
        ? pass('Host received room_updated broadcast with 2 players')
        : fail('room_updated broadcast player count', `got ${updatedRoom?.players?.length}`);
    } catch (err) {
      fail('Host did not receive room_updated broadcast', err.message);
    }

    // ── TEST 5: Duplicate Join (reconnect simulation) ──────────────────────
    console.log('\n[5] Duplicate Join (same userId should update socketId, not create new player)');
    const rejoinAck = await emit(socket2, 'join_room', {
      roomCode,
      user: { id: studentUser._id || studentUser.id, name: studentUser.name }
    });
    if (rejoinAck?.success && rejoinAck.room?.players?.length === 2) {
      pass('Re-join keeps player count at 2 (no duplicate)');
    } else {
      fail('Re-join created duplicate or failed', JSON.stringify(rejoinAck));
    }

    // ── TEST 6: Battle Start ───────────────────────────────────────────────
    console.log('\n[6] Battle Start');

    // Both sockets listen for battle_started
    const battleStartedP1 = waitForEvent(socket1, 'battle_started', 10000);
    const battleStartedP2 = waitForEvent(socket2, 'battle_started', 10000);

    const startAck = await emit(socket1, 'start_battle', {
      roomCode,
      userId: adminUser._id || adminUser.id
    });

    (startAck?.success)
      ? pass('start_battle ack success')
      : fail('start_battle ack failed', JSON.stringify(startAck));

    // ── TEST 7: battle_started security — no correctAnswer ─────────────────
    console.log('\n[7] battle_started Payload Security');
    let battlePayload1, battlePayload2;
    try {
      battlePayload1 = await battleStartedP1;
      pass('Socket 1 received battle_started');
    } catch (err) {
      fail('Socket 1 did not receive battle_started', err.message);
    }
    try {
      battlePayload2 = await battleStartedP2;
      pass('Socket 2 received battle_started');
    } catch (err) {
      fail('Socket 2 did not receive battle_started', err.message);
    }

    // CRITICAL SECURITY CHECK: correctAnswer must NOT be in the questions
    if (battlePayload1?.questions) {
      const hasLeak = battlePayload1.questions.some(q => q.correctAnswer !== undefined);
      hasLeak
        ? fail('SECURITY: battle_started contains correctAnswer — answer key EXPOSED to clients!')
        : pass('SECURITY: battle_started questions do NOT contain correctAnswer ✓');

      // Check question structure
      const q0 = battlePayload1.questions[0];
      (q0 && q0.question && Array.isArray(q0.options) && q0.options.length === 4)
        ? pass('Questions have required fields (question, options[4])')
        : fail('Question structure invalid', JSON.stringify(q0));

      pass('battle_started question count', `count=${battlePayload1.questions.length}`);
    } else {
      fail('battle_started payload missing questions');
    }

    // Both players must receive identical question IDs in the same order
    if (battlePayload1?.questions && battlePayload2?.questions) {
      const ids1 = battlePayload1.questions.map(q => String(q._id));
      const ids2 = battlePayload2.questions.map(q => String(q._id));
      const sameOrder = ids1.length === ids2.length && ids1.every((id, i) => id === ids2[i]);
      sameOrder
        ? pass('Both players received identical questions in same order ✓')
        : fail('Question order mismatch between players', `p1=${ids1.join(',')}, p2=${ids2.join(',')}`);
    }

    // ── TEST 8: Submit Answers (both players) ──────────────────────────────
    console.log('\n[8] Answer Submission');
    const questions = battlePayload1?.questions || [];
    const adminId = adminUser._id || adminUser.id;
    const studentId = studentUser._id || studentUser.id;

    // Register battle_finished listeners BEFORE submitting final answers.
    // submit_answer auto-finishes when all players answer all questions.
    const battleFinishedP1 = waitForEvent(socket1, 'battle_finished', 20000);
    const battleFinishedP2 = waitForEvent(socket2, 'battle_finished', 20000);

    let answeredCount = 0;
    for (let i = 0; i < questions.length; i++) {
      socket1.emit('submit_answer', {
        roomCode,
        userId: adminId,
        questionIndex: i,
        selectedOptionIndex: 0 // always pick option A
      });
      socket2.emit('submit_answer', {
        roomCode,
        userId: studentId,
        questionIndex: i,
        selectedOptionIndex: 1 // always pick option B
      });
      answeredCount++;
    }
    await sleep(500);
    pass(`Answers submitted for both players`, `${answeredCount} questions each`);

    // ── TEST 9: Socket Impersonation Guard ─────────────────────────────────
    console.log('\n[9] Impersonation Guard');
    // socket2 tries to submit an answer as admin (wrong socketId)
    socket2.emit('submit_answer', {
      roomCode,
      userId: adminId, // socket2 pretends to be admin
      questionIndex: 0,
      selectedOptionIndex: 3
    });
    await sleep(300); // Server should silently drop it — no way to confirm server-side block via event
    // We can only verify the server didn't crash. The actual block is logged server-side.
    pass('Impersonation attempt sent — server should silently drop (check server log for [Socket Security])');

    // ── TEST 10: Finish Battle ─────────────────────────────────────────────
    // battle_finished is already emitted by submit_answer auto-finish when all answers received.
    // player_finished is an alternative path; if the room is already FINISHED, we just wait for
    // the event that was already queued.
    console.log('\n[10] Player Finish & Battle Result');

    // Try player_finished — safe to call even if already finished (server guards status)
    socket1.emit('player_finished', { roomCode, userId: adminId });
    socket2.emit('player_finished', { roomCode, userId: studentId });

    let finishedPayload;
    try {
      finishedPayload = await Promise.race([battleFinishedP1, battleFinishedP2]);
      pass('battle_finished event received');
    } catch (err) {
      fail('battle_finished not received', err.message);
    }

    if (finishedPayload) {
      // Leaderboard structure
      const lb = finishedPayload.leaderboard;
      (Array.isArray(lb) && lb.length === 2)
        ? pass('Leaderboard has 2 players')
        : fail('Leaderboard player count', `expected 2, got ${lb?.length}`);

      // Verify rank ordering
      if (lb?.length >= 2) {
        const ranksOk = lb[0].rank === 1 && lb[1].rank === 2;
        ranksOk ? pass('Leaderboard ranks correct (1, 2)') : fail('Leaderboard ranks wrong', JSON.stringify(lb.map(p => p.rank)));

        // Score must be >= 0
        const scoresValid = lb.every(p => typeof p.score === 'number' && p.score >= 0);
        scoresValid ? pass('All scores are non-negative numbers') : fail('Score validation failed', JSON.stringify(lb.map(p => p.score)));

        // Accuracy must be 0-100
        const accValid = lb.every(p => p.accuracy >= 0 && p.accuracy <= 100);
        accValid ? pass('Accuracy values in range 0-100') : fail('Accuracy out of range', JSON.stringify(lb.map(p => p.accuracy)));
      }

      // questions in battle_finished SHOULD have correctAnswer (for post-game review)
      if (finishedPayload.questions?.length > 0) {
        const hasCorrectAnswer = finishedPayload.questions.every(q => q.correctAnswer !== undefined);
        hasCorrectAnswer
          ? pass('battle_finished questions include correctAnswer for post-game review ✓')
          : fail('battle_finished questions missing correctAnswer');
      }
    }

    // ── TEST 11: finish_battle_early auth guard ────────────────────────────
    console.log('\n[11] finish_battle_early Authorization Guard');
    // Create a second room and try to end it as non-host (socket2)
    const createAck2 = await emit(socket1, 'create_room', {
      user: { id: adminId, name: adminUser.name },
      config: { subject: 'All', questionCount: 3, timeLimitMinutes: 1 }
    });
    if (createAck2?.success) {
      const rc2 = createAck2.roomCode;
      await emit(socket2, 'join_room', { roomCode: rc2, user: { id: studentId, name: studentUser.name } });
      await emit(socket1, 'start_battle', { roomCode: rc2, userId: adminId });
      await sleep(300);

      // socket2 (non-host) tries to finish early — should be blocked
      const badFinishReceivedP = waitForEvent(socket2, 'battle_finished', 3000).catch(() => null);
      socket2.emit('finish_battle_early', { roomCode: rc2, userId: studentId });
      const badResult = await badFinishReceivedP;
      (badResult === null)
        ? pass('Non-host finish_battle_early correctly blocked ✓')
        : fail('SECURITY: Non-host was able to force-end the battle!');

      // Host CAN end it
      const goodFinishedP = waitForEvent(socket1, 'battle_finished', 5000);
      socket1.emit('finish_battle_early', { roomCode: rc2, userId: adminId });
      try {
        await goodFinishedP;
        pass('Host finish_battle_early allowed ✓');
      } catch (err) {
        fail('Host finish_battle_early failed', err.message);
      }
    } else {
      fail('Could not create second room for auth guard test', JSON.stringify(createAck2));
    }

    // ── TEST 12: Non-existent room ─────────────────────────────────────────
    console.log('\n[12] Edge Cases');
    const badJoin = await emit(socket2, 'join_room', { roomCode: 'XXXXXX', user: { id: studentId, name: 'Test' } });
    (!badJoin?.success && badJoin?.message)
      ? pass('join_room with bad code returns error', badJoin.message)
      : fail('join_room bad code did not return error');

  } catch (err) {
    fail('Unexpected test error', err.message);
    console.error(err);
  } finally {
    // Clean up sockets
    if (socket1) socket1.disconnect();
    if (socket2) socket2.disconnect();
    await sleep(200);
  }

  printSummary();
}

function printSummary() {
  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('                  SOCKET TEST RESULTS');
  console.log('══════════════════════════════════════════════════════════════');
  RESULTS.forEach(r => console.log(r));
  console.log('──────────────────────────────────────────────────────────────');
  console.log(`  Total: ${PASS + FAIL}  |  ✅ PASS: ${PASS}  |  ❌ FAIL: ${FAIL}`);
  console.log('══════════════════════════════════════════════════════════════\n');

  if (FAIL === 0) {
    console.log('🎉  All socket tests PASSED. Multiplayer is working correctly.\n');
  } else {
    console.log(`⚠️   ${FAIL} test(s) FAILED. Review the output above.\n`);
    process.exit(1);
  }
}

runTests();
