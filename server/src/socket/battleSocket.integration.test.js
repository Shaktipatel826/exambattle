/**
 * battleSocket.integration.test.js
 *
 * Two-client Socket.IO integration test for the full battle completion flow.
 * Uses a real HTTP+Socket.IO server on a random port, two real socket clients,
 * real room creation / join / start / submit / player_finished events, and
 * asserts that BOTH clients receive a valid battle_finished payload.
 *
 * No MongoDB needed — rooms are in-memory in activeRooms Map.
 * TestAttempt.create and awardUserXP will fail (no DB) but are non-fatal.
 *
 * Run:  node --test src/socket/battleSocket.integration.test.js
 *
 * IMPORTANT: Must run outside the sandbox (BypassSandbox: true) because
 * Socket.IO client cannot connect to localhost inside the sandboxed environment.
 */

import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { Server } from 'socket.io';
import { io as ioClient } from 'socket.io-client';
import { initializeBattleSocket } from './battleSocket.js';

// ─── Server setup ─────────────────────────────────────────────────────────────
let server;
let ioServer;
let serverPort;

function startServer() {
  return new Promise((resolve) => {
    server = http.createServer();
    ioServer = new Server(server, { cors: { origin: '*' } });
    initializeBattleSocket(ioServer);
    server.listen(0, () => {
      serverPort = server.address().port;
      console.log(`[Integration Test] Server listening on port ${serverPort}`);
      resolve();
    });
  });
}

function stopServer() {
  return new Promise((resolve) => {
    ioServer.close(() => server.close(resolve));
  });
}

function makeClient(label) {
  const socket = ioClient(`http://localhost:${serverPort}`, {
    transports: ['websocket'],
    reconnection: false,
  });
  socket._label = label;
  return socket;
}

function waitForEvent(socket, eventName, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      reject(new Error(`[${socket._label}] Timed out waiting for "${eventName}" after ${timeoutMs}ms`));
    }, timeoutMs);
    socket.once(eventName, (data) => {
      clearTimeout(t);
      resolve(data);
    });
  });
}

function emitAck(socket, eventName, payload, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      reject(new Error(`[${socket._label}] ACK timed out for "${eventName}" after ${timeoutMs}ms`));
    }, timeoutMs);
    socket.emit(eventName, payload, (ack) => {
      clearTimeout(t);
      resolve(ack);
    });
  });
}

// ─── Test suite ───────────────────────────────────────────────────────────────
describe('Battle Socket — Two-Client Integration', () => {
  before(startServer);
  after(stopServer);

  test('Complete 2-player battle: both submit → both receive battle_finished', async () => {
    const hostId    = 'user_host_001';
    const guestId   = 'user_guest_002';
    const hostSocket  = makeClient('Alice');
    const guestSocket = makeClient('Bob');

    try {
      // Wait for both sockets to connect
      await Promise.all([
        waitForEvent(hostSocket,  'connect'),
        waitForEvent(guestSocket, 'connect'),
      ]);
      console.log(`[Test] Host  connected: ${hostSocket.id}`);
      console.log(`[Test] Guest connected: ${guestSocket.id}`);

      // Host creates a room with 3 MCQ questions
      const testQuestions = [
        { _id: 'q1', question: 'Q1', options: ['A','B','C','D'], correctAnswer: 0, questionType: 'mcq', subject: 'Test', topic: 'T' },
        { _id: 'q2', question: 'Q2', options: ['A','B','C','D'], correctAnswer: 1, questionType: 'mcq', subject: 'Test', topic: 'T' },
        { _id: 'q3', question: 'Q3', options: ['A','B','C','D'], correctAnswer: 2, questionType: 'mcq', subject: 'Test', topic: 'T' },
      ];

      const createAck = await emitAck(hostSocket, 'create_room_with_questions', {
        user: { id: hostId, name: 'Alice' },
        config: { subject: 'Test', timeLimitMinutes: 1, negativeMarking: 0.25 },
        questions: testQuestions,
      });
      console.log(`[Test] create_room_with_questions ack: success=${createAck.success}`);
      assert.ok(createAck.success, `Room creation failed: ${createAck.message}`);
      const roomCode = createAck.roomCode;
      console.log(`[Test] Room created: ${roomCode}`);

      // Guest joins
      const [joinAck] = await Promise.all([
        emitAck(guestSocket, 'join_room', { roomCode, user: { id: guestId, name: 'Bob' } }),
        waitForEvent(hostSocket, 'room_updated').catch(() => null),
      ]);
      assert.ok(joinAck.success, `Guest join failed: ${joinAck.message}`);
      assert.equal(joinAck.room.players.length, 2, 'Room should have 2 players');
      console.log(`[Test] ✅ Guest joined. Players: ${joinAck.room.players.length}`);

      // ── CRITICAL: Register battle_finished listeners BEFORE start_battle ──────
      // battle_started fires immediately after start_battle ack.
      // battle_finished may fire immediately once all answers are submitted.
      // Registering listeners late causes missed events.
      const hostStartedP    = waitForEvent(hostSocket,  'battle_started', 8000);
      const guestStartedP   = waitForEvent(guestSocket, 'battle_started', 8000);
      const hostFinishedP   = waitForEvent(hostSocket,  'battle_finished', 15000);
      const guestFinishedP  = waitForEvent(guestSocket, 'battle_finished', 15000);

      // Host starts battle
      const startAck = await emitAck(hostSocket, 'start_battle', { roomCode, userId: hostId });
      console.log(`[Test] start_battle ack: success=${startAck.success}`);
      assert.ok(startAck.success, `start_battle failed: ${startAck.message}`);

      // Both clients receive battle_started
      const [hostStarted, guestStarted] = await Promise.all([hostStartedP, guestStartedP]);
      console.log(`[Test] ✅ battle_started: host got ${hostStarted.questions.length} q, guest got ${guestStarted.questions.length} q`);
      assert.equal(hostStarted.questions.length, 3, 'Host should get 3 questions');
      assert.equal(guestStarted.questions.length, 3, 'Guest should get 3 questions');

      // Host answers: Q1 correct (0), Q2 wrong (0 vs correct 1), Q3 skip (-1)
      hostSocket.emit('submit_answer', { roomCode, userId: hostId, questionIndex: 0, selectedOptionIndex: 0 }); // correct
      hostSocket.emit('submit_answer', { roomCode, userId: hostId, questionIndex: 1, selectedOptionIndex: 0 }); // wrong
      hostSocket.emit('submit_answer', { roomCode, userId: hostId, questionIndex: 2, selectedOptionIndex: -1 }); // skip

      // Guest answers all 3 correctly
      guestSocket.emit('submit_answer', { roomCode, userId: guestId, questionIndex: 0, selectedOptionIndex: 0 }); // correct
      guestSocket.emit('submit_answer', { roomCode, userId: guestId, questionIndex: 1, selectedOptionIndex: 1 }); // correct
      guestSocket.emit('submit_answer', { roomCode, userId: guestId, questionIndex: 2, selectedOptionIndex: 2 }); // correct

      // Emit player_finished for both (NOTE: server may have auto-finished via submit_answer already)
      // The listeners are registered above so we won't miss the event either way.
      await new Promise(r => setTimeout(r, 100));
      hostSocket.emit('player_finished',  { roomCode, userId: hostId });
      guestSocket.emit('player_finished', { roomCode, userId: guestId });

      // Wait for battle_finished on both clients
      console.log(`[Test] Waiting for battle_finished on both clients...`);
      const [hostResult, guestResult] = await Promise.all([hostFinishedP, guestFinishedP]);

      console.log(`[Test] ✅ Both clients received battle_finished`);

      // Verify both received the same leaderboard
      assert.ok(hostResult.leaderboard,  'Host result missing leaderboard');
      assert.ok(guestResult.leaderboard, 'Guest result missing leaderboard');
      assert.equal(hostResult.leaderboard.length, 2, 'Leaderboard must have 2 entries');
      assert.equal(guestResult.leaderboard.length, 2, 'Leaderboard must have 2 entries (guest)');

      assert.deepEqual(
        hostResult.leaderboard.map(p => p.userId).sort(),
        guestResult.leaderboard.map(p => p.userId).sort(),
        'Both clients must receive same player list'
      );

      // Questions included for review
      assert.ok(Array.isArray(hostResult.questions), 'Host result must include questions');
      assert.equal(hostResult.questions.length, 3, 'Host result must include all 3 questions');

      // Verify scoring correctness
      const guestEntry = hostResult.leaderboard.find(p => p.userId === guestId);
      const hostEntry  = hostResult.leaderboard.find(p => p.userId === hostId);

      console.log(`[Test] Scoring — Guest (Bob):`, JSON.stringify(guestEntry));
      console.log(`[Test] Scoring — Host  (Alice):`, JSON.stringify(hostEntry));

      // Guest: 3 correct → score = 3
      assert.equal(guestEntry.correctCount,      3, 'Guest should have 3 correct');
      assert.equal(guestEntry.wrongCount,        0, 'Guest should have 0 wrong');
      assert.equal(guestEntry.unattemptedCount,  0, 'Guest should have 0 skipped');
      assert.equal(guestEntry.score,             3, 'Guest score should be 3');

      // Host: 1 correct (+1), 1 wrong (-0.25), 1 skipped (0) → score = max(0, 0.75) = 0.75
      assert.equal(hostEntry.correctCount,       1, 'Host should have 1 correct');
      assert.equal(hostEntry.wrongCount,         1, 'Host should have 1 wrong');
      assert.equal(hostEntry.unattemptedCount,   1, 'Host should have 1 skipped');
      assert.equal(hostEntry.score,              0.75, 'Host score should be 0.75');

      // Guest wins (rank 1)
      assert.equal(guestEntry.rank, 1, 'Guest (3 pts) should be rank 1');
      assert.equal(hostEntry.rank,  2, 'Host  (0.75 pts) should be rank 2');

      // submittedAnswers present for comparative review
      assert.ok(typeof guestEntry.submittedAnswers === 'object', 'Guest submittedAnswers missing');
      assert.ok(typeof hostEntry.submittedAnswers  === 'object', 'Host  submittedAnswers missing');

      console.log(`[Test] ✅ ALL ASSERTIONS PASSED — battle_finished received by both with correct scoring`);

    } finally {
      hostSocket.disconnect();
      guestSocket.disconnect();
    }
  });

  test('Reconnect during battle: new socket receives battle_started sync and can still submit', async () => {
    const hostId  = 'user_host_r01';
    const guestId = 'user_guest_r02';
    const hostSocket  = makeClient('Alice-R');
    const guestSocket = makeClient('Bob-R');

    try {
      await Promise.all([
        waitForEvent(hostSocket,  'connect'),
        waitForEvent(guestSocket, 'connect'),
      ]);

      const testQuestions = [
        { _id: 'rq1', question: 'RQ1', options: ['A','B','C','D'], correctAnswer: 0, questionType: 'mcq', subject: 'Test', topic: 'T' },
        { _id: 'rq2', question: 'RQ2', options: ['A','B','C','D'], correctAnswer: 1, questionType: 'mcq', subject: 'Test', topic: 'T' },
      ];

      const createAck = await emitAck(hostSocket, 'create_room_with_questions', {
        user: { id: hostId, name: 'Alice-R' },
        config: { subject: 'Test', timeLimitMinutes: 1, negativeMarking: 0.25 },
        questions: testQuestions,
      });
      assert.ok(createAck.success);
      const roomCode = createAck.roomCode;

      const joinAck = await emitAck(guestSocket, 'join_room', {
        roomCode, user: { id: guestId, name: 'Bob-R' },
      });
      assert.ok(joinAck.success);

      // Register battle_started listeners BEFORE start_battle
      const hostStartedP   = waitForEvent(hostSocket,  'battle_started', 8000);
      const guestStartedP  = waitForEvent(guestSocket, 'battle_started', 8000);
      // Register battle_finished BEFORE any submissions
      const hostFinishedP  = waitForEvent(hostSocket,  'battle_finished', 20000);

      const startAck = await emitAck(hostSocket, 'start_battle', { roomCode, userId: hostId });
      assert.ok(startAck.success);

      await Promise.all([hostStartedP, guestStartedP]);
      console.log(`[Reconnect Test] Battle started.`);

      // Create a brand-new socket (simulates reconnect with new socket ID)
      const guestSocket2 = makeClient('Bob-R-reconnected');
      await waitForEvent(guestSocket2, 'connect');
      console.log(`[Reconnect Test] New guest socket: ${guestSocket2.id}`);

      // Register battle_finished on new socket BEFORE re-join
      // (battle_started is emitted during join_room processing, before the ack)
      const guestSyncedP   = waitForEvent(guestSocket2, 'battle_started', 8000);
      const guestFinishedP = waitForEvent(guestSocket2, 'battle_finished', 20000);

      // Guest re-joins — server should sync battle_started to the new socket
      const rejoinAck = await emitAck(guestSocket2, 'join_room', {
        roomCode, user: { id: guestId, name: 'Bob-R' },
      });
      assert.ok(rejoinAck.success, `Re-join failed: ${rejoinAck.message}`);

      // New socket should receive battle_started sync (event fires during join_room)
      const syncedStart = await guestSyncedP;
      console.log(`[Reconnect Test] ✅ Reconnected socket received battle_started: ${syncedStart.questions.length} q`);
      assert.equal(syncedStart.questions.length, 2, 'Reconnected guest should receive 2 questions');

      // Submit answers from new socket for guest
      guestSocket2.emit('submit_answer', { roomCode, userId: guestId, questionIndex: 0, selectedOptionIndex: 0 });
      guestSocket2.emit('submit_answer', { roomCode, userId: guestId, questionIndex: 1, selectedOptionIndex: 1 });
      hostSocket.emit('submit_answer',   { roomCode, userId: hostId,  questionIndex: 0, selectedOptionIndex: 0 });
      hostSocket.emit('submit_answer',   { roomCode, userId: hostId,  questionIndex: 1, selectedOptionIndex: 0 });

      await new Promise(r => setTimeout(r, 100));

      hostSocket.emit('player_finished',   { roomCode, userId: hostId });
      guestSocket2.emit('player_finished', { roomCode, userId: guestId });

      const [r1, r2] = await Promise.all([hostFinishedP, guestFinishedP]);

      assert.ok(r1.leaderboard, 'Host should receive leaderboard after reconnect scenario');
      assert.ok(r2.leaderboard, 'Reconnected guest should receive leaderboard');
      assert.equal(r1.leaderboard.length, 2);
      assert.equal(r2.leaderboard.length, 2);

      console.log(`[Reconnect Test] ✅ Both received battle_finished after reconnect`);
      guestSocket2.disconnect();

    } finally {
      hostSocket.disconnect();
      guestSocket.disconnect();
    }
  });

  test('socketId mismatch self-healing: player_finished accepted even when socketId changed', async () => {
    const hostId  = 'user_mismatch_h01';
    const guestId = 'user_mismatch_g02';
    const hostSocket  = makeClient('Alice-M');
    const guestSocket = makeClient('Bob-M');

    try {
      await Promise.all([
        waitForEvent(hostSocket,  'connect'),
        waitForEvent(guestSocket, 'connect'),
      ]);

      const testQ = [
        { _id: 'mq1', question: 'MQ1', options: ['A','B'], correctAnswer: 0, questionType: 'mcq', subject: 'Test', topic: 'T' },
      ];

      const createAck = await emitAck(hostSocket, 'create_room_with_questions', {
        user: { id: hostId, name: 'Alice-M' },
        config: { subject: 'Test', timeLimitMinutes: 1, negativeMarking: 0 },
        questions: testQ,
      });
      assert.ok(createAck.success);
      const roomCode = createAck.roomCode;

      const joinAck = await emitAck(guestSocket, 'join_room', {
        roomCode, user: { id: guestId, name: 'Bob-M' },
      });
      assert.ok(joinAck.success);

      // Register listeners BEFORE start_battle
      const hostStartedP  = waitForEvent(hostSocket,  'battle_started', 8000);
      const guestStartedP = waitForEvent(guestSocket, 'battle_started', 8000);
      // Register finished BEFORE any submissions
      const hostFinishedP = waitForEvent(hostSocket, 'battle_finished', 15000);

      const startAck = await emitAck(hostSocket, 'start_battle', { roomCode, userId: hostId });
      assert.ok(startAck.success);

      await Promise.all([hostStartedP, guestStartedP]);

      // Simulate socketId mismatch: guest uses a NEW socket but same userId
      const guestSocket2 = makeClient('Bob-M-new');
      await waitForEvent(guestSocket2, 'connect');

      // Register finished on new socket BEFORE re-join (battle_started fires during join_room)
      const guestSyncedP2  = waitForEvent(guestSocket2, 'battle_started', 8000);
      const guestFinishedP = waitForEvent(guestSocket2, 'battle_finished', 15000);

      // Re-join to update socketId in the room
      await emitAck(guestSocket2, 'join_room', { roomCode, user: { id: guestId, name: 'Bob-M' } });
      await guestSyncedP2.catch(() => null); // battle_started sync (may already have fired)

      // Submit answers from new socket (would have been blocked by old strict socketId check)
      guestSocket2.emit('submit_answer', { roomCode, userId: guestId, questionIndex: 0, selectedOptionIndex: 0 });
      hostSocket.emit('submit_answer',   { roomCode, userId: hostId,  questionIndex: 0, selectedOptionIndex: 0 });

      await new Promise(r => setTimeout(r, 100));

      hostSocket.emit('player_finished',   { roomCode, userId: hostId });
      guestSocket2.emit('player_finished', { roomCode, userId: guestId });

      const [r1, r2] = await Promise.all([hostFinishedP, guestFinishedP]);

      assert.ok(r1.leaderboard, 'Host must receive leaderboard');
      assert.ok(r2.leaderboard, 'New guest socket must receive leaderboard');
      assert.equal(r1.leaderboard.length, 2, 'Both players in leaderboard');

      const guestEntry = r1.leaderboard.find(p => p.userId === guestId);
      assert.equal(guestEntry.correctCount, 1, 'Guest answer must be recorded even after socket change');

      console.log(`[Mismatch Test] ✅ socketId self-healing works — player_finished accepted after socket change`);

      guestSocket2.disconnect();
    } finally {
      hostSocket.disconnect();
      guestSocket.disconnect();
    }
  });
});
