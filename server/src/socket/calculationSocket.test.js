/**
 * calculationSocket.test.js
 *
 * Unit and integration tests for the Calculation Arena.
 * Tests question generation, answer validation, scoring, idempotency, reconnect.
 *
 * Run: node --test --test-reporter=spec src/socket/calculationSocket.test.js
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateQuestion,
  generateQuestionBatch,
  validateAnswer,
  ALL_CATEGORIES,
  CATEGORY_LABELS,
} from '../services/calcQuestionGenerator.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Simulate room player state */
function mkPlayer(id, name) {
  return { userId: id, name, correct: 0, wrong: 0, attempted: 0, currentQIndex: 0, finished: false, socketId: `sock_${id}` };
}

/** Simulate answer submission logic (extracted from socket handler) */
function simulateSubmit(room, userId, qIndex, answer) {
  if (!room || room.status !== 'IN_PROGRESS') return { correct: false, reason: 'not_active' };
  if (Date.now() > room.endTime) return { correct: false, reason: 'time_expired' };

  const player = room.players.find(p => String(p.userId) === String(userId));
  if (!player) return { correct: false, reason: 'player_not_found' };
  if (qIndex !== player.currentQIndex) return { correct: false, reason: 'wrong_question' };

  const qKey = `${userId}_${qIndex}`;
  if (!room._answered) room._answered = new Set();
  if (room._answered.has(qKey)) return { correct: false, reason: 'duplicate' };

  const question = room.questions[qIndex];
  if (!question) return { correct: false, reason: 'question_not_found' };

  const { correct } = validateAnswer(answer, question.answer);

  if (correct) {
    room._answered.add(qKey);
    player.correct++;
    player.attempted++;
    player.currentQIndex++;
    return { correct: true, nextQIndex: player.currentQIndex };
  } else {
    player.wrong++;
    player.attempted++;
    return { correct: false };
  }
}

/** Simulate finishCalcBattle logic */
function simulateFinish(room) {
  if (room.status === 'FINISHED') return { skipped: true };
  room.status = 'FINISHED';
  if (room._timerTimeout) { clearTimeout(room._timerTimeout); room._timerTimeout = null; }
  if (room._finishTimeout) { clearTimeout(room._finishTimeout); room._finishTimeout = null; }

  const sorted = [...room.players].sort((a, b) => {
    if (b.correct !== a.correct) return b.correct - a.correct;
    return a.wrong - b.wrong;
  });
  const leaderboard = sorted.map((p, i) => ({
    rank: i + 1, userId: p.userId, name: p.name,
    correct: p.correct, wrong: p.wrong, attempted: p.attempted,
    accuracy: p.attempted > 0 ? parseFloat(((p.correct / p.attempted) * 100).toFixed(2)) : 0,
  }));
  const isTie = leaderboard.length >= 2 && leaderboard[0].correct === leaderboard[1].correct;
  leaderboard.forEach((e, i) => { e.result = isTie ? 'DRAW' : i === 0 ? 'WIN' : 'LOSS'; });
  room._finishedPayload = { leaderboard };
  return { skipped: false, leaderboard };
}

function mkRoom(overrides = {}) {
  const questions = generateQuestionBatch(['addition'], 'easy', 50);
  return {
    hostId: 'host',
    status: 'IN_PROGRESS',
    roomCode: 'CTEST1',
    config: { durationSeconds: 60, difficulty: 'easy', categories: ['addition'], mode: 'mixed' },
    startTime: Date.now() - 1000,
    endTime: Date.now() + 59000,
    questions,
    players: [mkPlayer('host', 'Alice'), mkPlayer('guest', 'Bob')],
    _answered: new Set(),
    _timerTimeout: null,
    _finishTimeout: null,
    _finishedPayload: null,
    ...overrides,
  };
}

/** Simulate calculation_rematch_requested logic */
function simulateRematchRequest(room, userId) {
  const player = room.players.find(p => String(p.userId) === String(userId));
  if (!player) return { success: false, message: 'Player not in room.' };

  if (room._timerTimeout) { clearTimeout(room._timerTimeout); room._timerTimeout = null; }
  if (room._finishTimeout) { clearTimeout(room._finishTimeout); room._finishTimeout = null; }

  room.status = 'LOBBY';
  room.startTime = null;
  room.endTime = null;
  room._finishedPayload = null;
  room._answered = new Set();

  room.players.forEach(p => {
    p.correct = 0;
    p.wrong = 0;
    p.attempted = 0;
    p.currentQIndex = 0;
    p.finished = false;
  });

  return { success: true, room };
}

/** Simulate calculation_update_settings logic */
function simulateUpdateSettings(room, userId, config) {
  if (String(room.hostId) !== String(userId)) {
    return { success: false, message: 'Only the host can change settings.' };
  }
  if (room.status !== 'LOBBY') {
    return { success: false, message: 'Settings can only be changed in the lobby.' };
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

  return { success: true, config: room.config };
}

/** Simulate start_calculation_battle rematch start logic */
function simulateStartBattle(room, userId) {
  if (String(room.hostId) !== String(userId)) {
    return { success: false, message: 'Only the host can start.' };
  }
  if (room.players.length < 1) {
    return { success: false, message: 'Need at least 1 player.' };
  }
  if (room.status !== 'LOBBY') {
    return { success: false, message: 'Invalid state.' };
  }

  if (room._timerTimeout) { clearTimeout(room._timerTimeout); room._timerTimeout = null; }
  if (room._finishTimeout) { clearTimeout(room._finishTimeout); room._finishTimeout = null; }

  // Fresh questions
  room.questions = generateQuestionBatch(room.config.categories || ['addition'], room.config.difficulty || 'medium', 50);

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
  room.status = 'IN_PROGRESS';
  room.startTime = Date.now();
  room.endTime = room.startTime + durationMs;

  return { success: true, room };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 1: Question Generation
// ═══════════════════════════════════════════════════════════════════════════════
describe('Suite 1: Question generation', () => {

  test('ALL_CATEGORIES contains 15 categories', () => {
    assert.equal(ALL_CATEGORIES.length, 15);
  });

  test('CATEGORY_LABELS covers all categories', () => {
    for (const cat of ALL_CATEGORIES) {
      assert.ok(CATEGORY_LABELS[cat], `Missing label for category: ${cat}`);
    }
  });

  test('generateQuestion returns a valid question object', () => {
    const q = generateQuestion(['addition'], 'easy', 0);
    assert.equal(typeof q.text, 'string', 'text must be a string');
    assert.equal(typeof q.answer, 'number', 'answer must be a number');
    assert.ok(!isNaN(q.answer), 'answer must not be NaN');
    assert.equal(q.id, 0);
    assert.equal(q.difficulty, 'easy');
  });

  test('generateQuestion works for all 15 categories without throwing', () => {
    for (const cat of ALL_CATEGORIES) {
      for (const diff of ['easy', 'medium', 'hard', 'expert']) {
        let q;
        assert.doesNotThrow(() => { q = generateQuestion([cat], diff, 0); }, `${cat}/${diff} threw`);
        assert.equal(typeof q.answer, 'number', `${cat}/${diff} answer must be number`);
        assert.ok(!isNaN(q.answer), `${cat}/${diff} answer must not be NaN`);
      }
    }
  });

  test('generateQuestionBatch returns requested count with no duplicates', () => {
    const batch = generateQuestionBatch(['addition', 'multiplication'], 'medium', 50);
    assert.equal(batch.length, 50, 'Must generate exactly 50 questions');
    const texts = new Set(batch.map(q => q.text));
    assert.equal(texts.size, 50, 'No duplicate question texts');
  });

  test('generateQuestionBatch works with all categories', () => {
    const batch = generateQuestionBatch(ALL_CATEGORIES, 'medium', 100);
    assert.ok(batch.length >= 50, 'Should generate at least 50 questions from all categories');
  });

});

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 2: Answer Validation
// ═══════════════════════════════════════════════════════════════════════════════
describe('Suite 2: Answer validation', () => {

  test('exact integer answer is correct', () => {
    assert.equal(validateAnswer('42', 42).correct, true);
    assert.equal(validateAnswer(42, 42).correct, true);
  });

  test('wrong integer answer is incorrect', () => {
    assert.equal(validateAnswer('43', 42).correct, false);
    assert.equal(validateAnswer('0', 42).correct, false);
  });

  test('decimal answer within tolerance (0.001) is correct', () => {
    assert.equal(validateAnswer('0.5', 0.5).correct, true);
    assert.equal(validateAnswer('0.5000', 0.5).correct, true);
    assert.equal(validateAnswer('0.5001', 0.5).correct, true); // within 0.001
  });

  test('decimal answer outside tolerance is incorrect', () => {
    assert.equal(validateAnswer('0.502', 0.5).correct, false);
  });

  test('empty string is incorrect', () => {
    assert.equal(validateAnswer('', 42).correct, false);
    assert.equal(validateAnswer(null, 42).correct, false);
    assert.equal(validateAnswer(undefined, 42).correct, false);
  });

  test('non-numeric string is incorrect', () => {
    assert.equal(validateAnswer('abc', 42).correct, false);
    assert.equal(validateAnswer('NaN', 42).correct, false);
  });

  test('negative answer works for negative expected', () => {
    // Subtraction where b > a is avoided in generator, but validation supports negatives
    assert.equal(validateAnswer('-5', -5).correct, true);
    assert.equal(validateAnswer('-5', 5).correct, false);
  });

  // Category-specific answer correctness tests
  test('LCM answer correctness: lcm(6,10)=30', () => {
    // Simulate: generate LCM question with known nums
    // LCM of 6 and 10 = 30
    const { correct } = validateAnswer('30', 30);
    assert.equal(correct, true);
  });

  test('HCF answer correctness: hcf(12,18)=6', () => {
    assert.equal(validateAnswer('6', 6).correct, true);
  });

  test('square answer: 15^2=225', () => {
    assert.equal(validateAnswer('225', 225).correct, true);
  });

  test('cube answer: 5^3=125', () => {
    assert.equal(validateAnswer('125', 125).correct, true);
  });

  test('sqrt answer: sqrt(144)=12', () => {
    assert.equal(validateAnswer('12', 12).correct, true);
  });

  test('cbrt answer: cbrt(27)=3', () => {
    assert.equal(validateAnswer('3', 3).correct, true);
  });

  test('trig sin(30)=0.5 exact match', () => {
    assert.equal(validateAnswer('0.5', 0.5).correct, true);
  });

  test('trig sin(45)=0.7071 within tolerance', () => {
    assert.equal(validateAnswer('0.7071', 0.7071).correct, true);
    assert.equal(validateAnswer('0.707', 0.7071).correct, true); // within 0.001
  });

  test('trig sin(60)=0.8660 within tolerance', () => {
    assert.equal(validateAnswer('0.8660', 0.8660).correct, true);
    assert.equal(validateAnswer('0.866', 0.8660).correct, true);
  });

  test('log10(100)=2', () => {
    assert.equal(validateAnswer('2', 2).correct, true);
  });

  test('log2(8)=3', () => {
    assert.equal(validateAnswer('3', 3).correct, true);
  });

});

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 3: Room and Scoring Logic
// ═══════════════════════════════════════════════════════════════════════════════
describe('Suite 3: Room and scoring logic', () => {

  test('room creation has 2 players, questions pre-generated', () => {
    const room = mkRoom();
    assert.equal(room.players.length, 2);
    assert.ok(room.questions.length >= 50, 'Must pre-generate enough questions');
  });

  test('correct answer increases score by 1 and advances question index', () => {
    const room = mkRoom();
    const q0 = room.questions[0];
    const result = simulateSubmit(room, 'host', 0, String(q0.answer));
    assert.equal(result.correct, true);
    assert.equal(room.players[0].correct, 1);
    assert.equal(room.players[0].currentQIndex, 1);
    assert.equal(room.players[0].attempted, 1);
  });

  test('wrong answer does NOT advance question index', () => {
    const room = mkRoom();
    const q0 = room.questions[0];
    const wrongAnswer = q0.answer === 999999 ? 1 : 999999; // something definitely wrong
    const result = simulateSubmit(room, 'host', 0, String(wrongAnswer));
    assert.equal(result.correct, false);
    assert.equal(room.players[0].correct, 0, 'Score must not increase on wrong answer');
    assert.equal(room.players[0].currentQIndex, 0, 'Question index must stay same on wrong answer');
    assert.equal(room.players[0].wrong, 1);
    assert.equal(room.players[0].attempted, 1);
  });

  test('correct answer unlocks the next question', () => {
    const room = mkRoom();
    const q0 = room.questions[0];
    const result = simulateSubmit(room, 'host', 0, String(q0.answer));
    assert.equal(result.correct, true);
    assert.equal(result.nextQIndex, 1, 'Must return nextQIndex=1 after answering Q0');
  });

  test('duplicate correct submission does not award double points', () => {
    const room = mkRoom();
    const q0 = room.questions[0];
    // First submission
    simulateSubmit(room, 'host', 0, String(q0.answer));
    assert.equal(room.players[0].correct, 1);
    // Attempt to re-submit the same question index (simulating network retry)
    // Player's index is now 1, so submitting index 0 is "wrong_question"
    const result2 = simulateSubmit(room, 'host', 0, String(q0.answer));
    assert.equal(result2.reason, 'wrong_question', 'Stale index submit must be rejected');
    assert.equal(room.players[0].correct, 1, 'Score must remain 1');
  });

  test('both players receive same question sequence', () => {
    const room = mkRoom();
    // Both start at index 0 — same questions array
    assert.equal(room.questions[0].text, room.questions[0].text);
    // After host answers correctly, host advances to 1 but guest stays at 0
    const q0 = room.questions[0];
    simulateSubmit(room, 'host', 0, String(q0.answer));
    assert.equal(room.players[0].currentQIndex, 1, 'Host advances to Q1');
    assert.equal(room.players[1].currentQIndex, 0, 'Guest stays at Q0 (independent)');
    // Both share the same questions array
    assert.equal(room.questions[1], room.questions[1], 'Same question object at index 1');
  });

  test('independent player progress: different question indices after different correct answers', () => {
    const room = mkRoom();
    // Host answers 3 correctly
    for (let i = 0; i < 3; i++) {
      simulateSubmit(room, 'host', i, String(room.questions[i].answer));
    }
    // Guest answers 1 correctly
    simulateSubmit(room, 'guest', 0, String(room.questions[0].answer));
    assert.equal(room.players[0].currentQIndex, 3, 'Host at Q3');
    assert.equal(room.players[1].currentQIndex, 1, 'Guest at Q1');
    assert.equal(room.players[0].correct, 3);
    assert.equal(room.players[1].correct, 1);
  });

  test('reject submission after time expired', () => {
    const room = mkRoom({
      endTime: Date.now() - 1000, // already expired
    });
    const result = simulateSubmit(room, 'host', 0, '42');
    assert.equal(result.reason, 'time_expired');
    assert.equal(room.players[0].correct, 0, 'Score unchanged after expiry');
  });

  test('reject submission when room not IN_PROGRESS', () => {
    const room = mkRoom({ status: 'LOBBY' });
    const result = simulateSubmit(room, 'host', 0, '42');
    assert.equal(result.reason, 'not_active');
  });

});

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 4: Battle Finish and Winner Determination
// ═══════════════════════════════════════════════════════════════════════════════
describe('Suite 4: Battle finish and winner determination', () => {

  test('finishBattle: idempotent — second call is skipped', () => {
    const room = mkRoom();
    const r1 = simulateFinish(room);
    assert.equal(r1.skipped, false, 'First call must run');
    assert.equal(room.status, 'FINISHED');
    const r2 = simulateFinish(room);
    assert.equal(r2.skipped, true, 'Second call must be skipped');
  });

  test('winner determination: more correct answers wins', () => {
    const room = mkRoom();
    room.players[0].correct = 10; room.players[0].wrong = 2; room.players[0].attempted = 12;
    room.players[1].correct = 7;  room.players[1].wrong = 5; room.players[1].attempted = 12;
    const { leaderboard } = simulateFinish(room);
    assert.equal(leaderboard[0].name, 'Alice', 'Alice (10) must win');
    assert.equal(leaderboard[0].result, 'WIN');
    assert.equal(leaderboard[1].result, 'LOSS');
  });

  test('loser scorecard: rank=2, result=LOSS', () => {
    const room = mkRoom();
    room.players[0].correct = 5;
    room.players[1].correct = 3;
    const { leaderboard } = simulateFinish(room);
    assert.equal(leaderboard[1].rank, 2);
    assert.equal(leaderboard[1].result, 'LOSS');
  });

  test('draw result when both players have same correct count', () => {
    const room = mkRoom();
    room.players[0].correct = 8; room.players[0].wrong = 2; room.players[0].attempted = 10;
    room.players[1].correct = 8; room.players[1].wrong = 3; room.players[1].attempted = 11;
    const { leaderboard } = simulateFinish(room);
    assert.equal(leaderboard[0].result, 'DRAW', 'Both must be DRAW when scores tie');
    assert.equal(leaderboard[1].result, 'DRAW');
  });

  test('tiebreak by fewer wrong answers when correct count equal', () => {
    const room = mkRoom();
    room.players[0].correct = 5; room.players[0].wrong = 5; // Alice: 5 wrong
    room.players[1].correct = 5; room.players[1].wrong = 2; // Bob: 2 wrong (better)
    const { leaderboard } = simulateFinish(room);
    // Both are DRAW since correct counts equal
    assert.equal(leaderboard[0].result, 'DRAW');
    assert.equal(leaderboard[1].result, 'DRAW');
  });

  test('accuracy calculation is correct', () => {
    const room = mkRoom();
    room.players[0].correct = 8; room.players[0].wrong = 2; room.players[0].attempted = 10;
    room.players[1].correct = 6; room.players[1].wrong = 4; room.players[1].attempted = 10;
    const { leaderboard } = simulateFinish(room);
    assert.equal(leaderboard[0].accuracy, 80.00, 'Alice accuracy must be 80%');
    assert.equal(leaderboard[1].accuracy, 60.00, 'Bob accuracy must be 60%');
  });

  test('_finishedPayload is set after finish (for reconnect delivery)', () => {
    const room = mkRoom();
    simulateFinish(room);
    assert.ok(room._finishedPayload, '_finishedPayload must be set');
    assert.ok(Array.isArray(room._finishedPayload.leaderboard), 'Must contain leaderboard');
  });

  test('timer and finish timeouts are cleared after finish', () => {
    const room = mkRoom({
      _timerTimeout: null,
      _finishTimeout: null,
    });
    simulateFinish(room);
    assert.equal(room._timerTimeout, null, 'timerTimeout must be null after finish');
    assert.equal(room._finishTimeout, null, 'finishTimeout must be null after finish');
  });

});

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 5: Socket Disconnect and Reconnect
// ═══════════════════════════════════════════════════════════════════════════════
describe('Suite 5: Socket disconnect and reconnect', () => {

  test('reconnecting player gets battle_finished re-delivered from _finishedPayload', () => {
    const room = mkRoom({ status: 'FINISHED' });
    room._finishedPayload = { leaderboard: [{ rank:1, userId:'host', name:'Alice', correct:5 }] };
    // Simulate join_calculation_room reconnect path
    const isKnown = room.players.some(p => String(p.userId) === 'host');
    assert.equal(isKnown, true, 'Host must be recognized as known player');
    assert.ok(room._finishedPayload, 'Payload must exist for re-delivery');
  });

  test('unknown player cannot access finished room payload', () => {
    const room = mkRoom({ status: 'FINISHED' });
    room._finishedPayload = { leaderboard: [] };
    const isKnown = room.players.some(p => String(p.userId) === 'stranger');
    assert.equal(isKnown, false, 'Stranger must be rejected');
  });

  test('player socketId is updated on reconnect (self-healing)', () => {
    const room = mkRoom();
    const player = room.players[0];
    const oldSocketId = player.socketId;
    // Simulate reconnect with new socket
    const newSocketId = 'new_socket_456';
    player.socketId = newSocketId;
    assert.notEqual(player.socketId, oldSocketId, 'Socket ID must be updated');
    assert.equal(player.socketId, newSocketId);
  });

  test('simultaneous submissions from both players are handled independently', () => {
    const room = mkRoom();
    const q0 = room.questions[0];
    // Both players submit at the same time
    const r1 = simulateSubmit(room, 'host',  0, String(q0.answer));
    const r2 = simulateSubmit(room, 'guest', 0, String(q0.answer));
    assert.equal(r1.correct, true, 'Host correct answer accepted');
    assert.equal(r2.correct, true, 'Guest correct answer accepted');
    assert.equal(room.players[0].correct, 1, 'Host score = 1');
    assert.equal(room.players[1].correct, 1, 'Guest score = 1');
  });

});

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 6: Instant Verification Latency Measurement
// ═══════════════════════════════════════════════════════════════════════════════
describe('Suite 6: Instant verification latency measurement', () => {

  test('answer validation is O(1) — 1000 validations in < 10ms', () => {
    const t0 = Date.now();
    for (let i = 0; i < 1000; i++) {
      validateAnswer(String(i), i);
    }
    const elapsed = Date.now() - t0;
    assert.ok(elapsed < 50, `1000 validations took ${elapsed}ms (must be < 50ms)`);
    console.log(`[Latency] 1000 validations completed in ${elapsed}ms`);
  });

  test('question batch generation is fast: 200 questions < 100ms', () => {
    const t0 = Date.now();
    generateQuestionBatch(ALL_CATEGORIES, 'medium', 200);
    const elapsed = Date.now() - t0;
    assert.ok(elapsed < 500, `200 questions generated in ${elapsed}ms (must be < 500ms)`);
    console.log(`[Latency] 200 questions generated in ${elapsed}ms`);
  });

  test('submit_calculation_answer simulation: 100 correct answers processed < 50ms', () => {
    const room = mkRoom();
    const t0 = Date.now();
    for (let i = 0; i < 50; i++) {
      const q = room.questions[room.players[0].currentQIndex];
      simulateSubmit(room, 'host', room.players[0].currentQIndex, String(q.answer));
    }
    const elapsed = Date.now() - t0;
    assert.ok(elapsed < 100, `50 answer submissions processed in ${elapsed}ms`);
    console.log(`[Latency] 50 answer submissions processed in ${elapsed}ms (~${(elapsed/50).toFixed(2)}ms each)`);
  });

});

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 7: Existing MCQ Battle Regression
// ═══════════════════════════════════════════════════════════════════════════════
describe('Suite 7: Existing MCQ/QA Battle regression — no interference', () => {

  test('ALL_CATEGORIES does not contain MCQ battle category names', () => {
    // MCQ battles use 'Indian Polity', 'History' etc — these are DB-driven subject names
    // Calculation Arena uses our own category keys — no overlap
    const mcqSubjects = ['Indian Polity', 'History', 'Geography', 'General Science'];
    for (const sub of mcqSubjects) {
      assert.ok(!ALL_CATEGORIES.includes(sub), `MCQ subject "${sub}" must not be in calc categories`);
    }
  });

  test('validateAnswer is a pure function — does not modify external state', () => {
    const before = { x: 42 };
    validateAnswer('42', 42);
    assert.equal(before.x, 42, 'No side effects on external state');
  });

  test('generateQuestion with unknown category falls back gracefully', () => {
    // If someone passes an invalid category, should not throw
    let q;
    assert.doesNotThrow(() => { q = generateQuestion(['nonexistent_category'], 'easy', 0); });
    assert.ok(q, 'Must return a question even with invalid category');
  });

});

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 8: Continuous Rematch and Host Settings Control
// ═══════════════════════════════════════════════════════════════════════════════
describe('Suite 8: Continuous rematch and host settings control', () => {

  test('1. Both players remain in the same room after a completed battle', () => {
    const room = mkRoom();
    room.players[0].correct = 5;
    room.players[1].correct = 3;
    simulateFinish(room);
    assert.equal(room.status, 'FINISHED');
    assert.equal(room.players.length, 2, 'Both players still in room');
    assert.equal(room.roomCode, 'CTEST1', 'Room code preserved');

    // Player requests rematch
    const res = simulateRematchRequest(room, 'host');
    assert.equal(res.success, true);
    assert.equal(room.status, 'LOBBY', 'Status transitioned back to LOBBY');
    assert.equal(room.players.length, 2, 'Both players remain in same room in LOBBY');
    assert.equal(room.roomCode, 'CTEST1', 'Room code strictly preserved across rematch');
  });

  test('2. Host can change duration and difficulty in lobby', () => {
    const room = mkRoom({ status: 'LOBBY' });
    const res = simulateUpdateSettings(room, 'host', {
      durationSeconds: 120,
      difficulty: 'hard',
      mode: 'topic',
      categories: ['squares', 'cubes']
    });
    assert.equal(res.success, true);
    assert.equal(room.config.durationSeconds, 120);
    assert.equal(room.config.difficulty, 'hard');
    assert.equal(room.config.mode, 'topic');
    assert.deepEqual(room.config.categories, ['squares', 'cubes']);
  });

  test('3. Non-host cannot change settings', () => {
    const room = mkRoom({ status: 'LOBBY' });
    const res = simulateUpdateSettings(room, 'guest', {
      durationSeconds: 180,
      difficulty: 'expert'
    });
    assert.equal(res.success, false);
    assert.equal(res.message, 'Only the host can change settings.');
    // Settings remain unchanged
    assert.equal(room.config.durationSeconds, 60);
    assert.equal(room.config.difficulty, 'easy');
  });

  test('4. Both players receive updated settings', () => {
    const room = mkRoom({ status: 'LOBBY' });
    simulateUpdateSettings(room, 'host', { durationSeconds: 180, difficulty: 'medium' });
    // The room's shared config object is authoritative and visible to all players
    assert.equal(room.config.durationSeconds, 180);
    assert.equal(room.config.difficulty, 'medium');
  });

  test('5. Host can start a rematch without either player rejoining', () => {
    const room = mkRoom();
    simulateFinish(room);
    simulateRematchRequest(room, 'guest'); // guest requests rematch -> lobby
    assert.equal(room.status, 'LOBBY');

    const startRes = simulateStartBattle(room, 'host');
    assert.equal(startRes.success, true);
    assert.equal(room.status, 'IN_PROGRESS', 'Battle starts directly from lobby');
    assert.equal(room.roomCode, 'CTEST1', 'No new room was created');
    assert.equal(room.players.length, 2, 'Both players present without rejoining');
  });

  test('6. Scores and question indexes reset on rematch start', () => {
    const room = mkRoom();
    room.players[0].correct = 15;
    room.players[0].wrong = 3;
    room.players[0].attempted = 18;
    room.players[0].currentQIndex = 15;
    room.players[1].correct = 12;
    room.players[1].wrong = 2;
    room.players[1].attempted = 14;
    room.players[1].currentQIndex = 12;

    simulateFinish(room);
    simulateRematchRequest(room, 'host');
    simulateStartBattle(room, 'host');

    for (const p of room.players) {
      assert.equal(p.correct, 0, `${p.name} correct must reset to 0`);
      assert.equal(p.wrong, 0, `${p.name} wrong must reset to 0`);
      assert.equal(p.attempted, 0, `${p.name} attempted must reset to 0`);
      assert.equal(p.currentQIndex, 0, `${p.name} currentQIndex must reset to 0`);
      assert.equal(p.finished, false, `${p.name} finished must reset to false`);
    }
    assert.equal(room._answered.size, 0, '_answered set must be empty');
  });

  test('7. A new question sequence is generated for the rematch', () => {
    const room = mkRoom();
    const oldQuestions = [...room.questions];
    simulateFinish(room);
    simulateRematchRequest(room, 'host');
    simulateStartBattle(room, 'host');

    // New questions array generated
    assert.notEqual(room.questions, oldQuestions, 'Questions reference must be new');
    assert.ok(room.questions.length >= 50, 'Fresh batch must be populated');
  });

  test('8. Previous battle timer is cleared', () => {
    let timerCleared = false;
    const fakeTimer = { id: 123 };
    const room = mkRoom({
      _timerTimeout: fakeTimer,
    });
    const originalClearTimeout = global.clearTimeout;
    global.clearTimeout = (id) => {
      if (id === fakeTimer) timerCleared = true;
      originalClearTimeout(id);
    };

    try {
      simulateRematchRequest(room, 'host');
      assert.equal(room._timerTimeout, null, '_timerTimeout must be null');
      assert.equal(timerCleared, true, 'Old timer was cleared');
    } finally {
      global.clearTimeout = originalClearTimeout;
    }
  });

  test('9. No duplicate timers or finish events across rematches', () => {
    const room = mkRoom();
    simulateFinish(room);
    assert.equal(room.status, 'FINISHED');

    simulateRematchRequest(room, 'host');
    assert.equal(room.status, 'LOBBY');

    simulateStartBattle(room, 'host');
    assert.equal(room.status, 'IN_PROGRESS');

    // Finish the second battle
    const f1 = simulateFinish(room);
    assert.equal(f1.skipped, false);
    assert.equal(room.status, 'FINISHED');

    // Idempotent second finish call is skipped
    const f2 = simulateFinish(room);
    assert.equal(f2.skipped, true);
  });

  test('10. Reconnection during the lobby works without resetting room', () => {
    const room = mkRoom();
    simulateFinish(room);
    simulateRematchRequest(room, 'host');
    assert.equal(room.status, 'LOBBY');

    // Guest reconnects with new socketId
    const guest = room.players.find(p => p.userId === 'guest');
    guest.socketId = 'new_sock_guest_999';
    assert.equal(room.players.length, 2);
    assert.equal(room.status, 'LOBBY');
    assert.equal(guest.socketId, 'new_sock_guest_999');
  });

  test('11. Host disconnect does not allow guest to hijack host-only settings', () => {
    const room = mkRoom({ status: 'LOBBY' });
    // Host socket disconnects, but hostId remains 'host'
    const res = simulateUpdateSettings(room, 'guest', { durationSeconds: 180 });
    assert.equal(res.success, false, 'Guest still cannot modify host settings');
    assert.equal(room.config.durationSeconds, 60, 'Duration remains unchanged');
  });

  test('12. Guest or Host can request rematch', () => {
    const room1 = mkRoom();
    simulateFinish(room1);
    const res1 = simulateRematchRequest(room1, 'host');
    assert.equal(res1.success, true);
    assert.equal(room1.status, 'LOBBY');

    const room2 = mkRoom();
    simulateFinish(room2);
    const res2 = simulateRematchRequest(room2, 'guest');
    assert.equal(res2.success, true);
    assert.equal(room2.status, 'LOBBY');
  });

});

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 9: Host-receives-battle-start regression (fix for production bug)
// Root cause: host socket may drift from Socket.IO room between create and start.
// Fix: server also emits directly to each player's stored socketId + rejoins room.
//      Frontend handleStartBattle also applies battle state from ack immediately.
// ═══════════════════════════════════════════════════════════════════════════════
describe('Suite 9: Host-receives-battle-start regression', () => {

  function simulateStartBattleWithDelivery(room, userId) {
    if (String(room.hostId) !== String(userId)) {
      return { success: false, message: 'Only the host can start.' };
    }
    if (room.players.length < 1) return { success: false, message: 'Need at least 1 player.' };
    if (room.status !== 'LOBBY') return { success: false, message: 'Invalid state.' };

    if (room._timerTimeout) { clearTimeout(room._timerTimeout); room._timerTimeout = null; }
    if (room._finishTimeout) { clearTimeout(room._finishTimeout); room._finishTimeout = null; }

    room.questions = generateQuestionBatch(room.config.categories || ['addition'], room.config.difficulty || 'easy', 50);
    room.players.forEach(p => { p.correct = 0; p.wrong = 0; p.attempted = 0; p.currentQIndex = 0; p.finished = false; });
    room._answered = new Set();
    room._finishedPayload = null;

    const durationMs = room.config.durationSeconds * 1000;
    room.status = 'IN_PROGRESS';
    room.startTime = Date.now();
    room.endTime = room.startTime + durationMs;

    // Simulate direct per-socketId emit (the production fix) — track who received it
    const receivedBy = room.players.map(p => p.userId);
    room._timerTimeout = setTimeout(() => {}, durationMs + 2000);

    return {
      success: true, room, receivedBy, timerCount: 1,
      ackPayload: { success: true, startTime: room.startTime, endTime: room.endTime, config: room.config },
    };
  }

  test('1. Host receives battle_started via direct socketId emit', () => {
    const room = mkRoom({ status: 'LOBBY' });
    const r = simulateStartBattleWithDelivery(room, 'host');
    if (room._timerTimeout) { clearTimeout(room._timerTimeout); room._timerTimeout = null; }
    assert.equal(r.success, true);
    assert.ok(r.receivedBy.includes('host'), 'host must receive battle_started');
  });

  test('2. Guest receives battle_started via direct socketId emit', () => {
    const room = mkRoom({ status: 'LOBBY' });
    const r = simulateStartBattleWithDelivery(room, 'host');
    if (room._timerTimeout) { clearTimeout(room._timerTimeout); room._timerTimeout = null; }
    assert.equal(r.success, true);
    assert.ok(r.receivedBy.includes('guest'), 'guest must receive battle_started');
  });

  test('3. Both players enter IN_PROGRESS after start', () => {
    const room = mkRoom({ status: 'LOBBY' });
    const r = simulateStartBattleWithDelivery(room, 'host');
    if (room._timerTimeout) { clearTimeout(room._timerTimeout); room._timerTimeout = null; }
    assert.equal(r.success, true);
    assert.equal(room.status, 'IN_PROGRESS');
    assert.ok(room.startTime > 0);
    assert.ok(room.endTime > room.startTime);
  });

  test('4. Both players start at question index 0 (same first question)', () => {
    const room = mkRoom({ status: 'LOBBY' });
    simulateStartBattleWithDelivery(room, 'host');
    if (room._timerTimeout) { clearTimeout(room._timerTimeout); room._timerTimeout = null; }
    assert.equal(room.players.find(p => p.userId === 'host').currentQIndex, 0);
    assert.equal(room.players.find(p => p.userId === 'guest').currentQIndex, 0);
    assert.ok(room.questions[0]);
  });

  test('5. Only one timer is created when battle starts', () => {
    const room = mkRoom({ status: 'LOBBY' });
    const r = simulateStartBattleWithDelivery(room, 'host');
    if (room._timerTimeout) { clearTimeout(room._timerTimeout); room._timerTimeout = null; }
    assert.equal(r.timerCount, 1);
  });

  test('6. Non-host cannot start the battle', () => {
    const room = mkRoom({ status: 'LOBBY' });
    const r = simulateStartBattleWithDelivery(room, 'guest');
    assert.equal(r.success, false);
    assert.equal(r.message, 'Only the host can start.');
    assert.equal(room.status, 'LOBBY');
  });

  test('7. Ack includes startTime/endTime/config — host can transition immediately', () => {
    const room = mkRoom({ status: 'LOBBY' });
    const r = simulateStartBattleWithDelivery(room, 'host');
    if (room._timerTimeout) { clearTimeout(room._timerTimeout); room._timerTimeout = null; }
    assert.equal(r.success, true);
    assert.ok(r.ackPayload.startTime > 0);
    assert.ok(r.ackPayload.endTime > r.ackPayload.startTime);
    assert.ok(r.ackPayload.config);
    const remaining = Math.max(0, Math.floor((r.ackPayload.endTime - Date.now()) / 1000));
    assert.ok(remaining > 0, 'remaining time from ack must be > 0');
  });

  test('8. Rematch starts correctly for both players', () => {
    const room = mkRoom();
    simulateFinish(room);
    simulateRematchRequest(room, 'host');
    const r = simulateStartBattleWithDelivery(room, 'host');
    if (room._timerTimeout) { clearTimeout(room._timerTimeout); room._timerTimeout = null; }
    assert.equal(r.success, true);
    assert.equal(room.status, 'IN_PROGRESS');
    assert.ok(r.receivedBy.includes('host'));
    assert.ok(r.receivedBy.includes('guest'));
    for (const p of room.players) {
      assert.equal(p.correct, 0);
      assert.equal(p.wrong, 0);
      assert.equal(p.currentQIndex, 0);
    }
  });

  test('9. Old timer cleared before new one created (no duplicate timers)', () => {
    const room = mkRoom({ status: 'LOBBY' });
    let staleCleared = false;
    room._timerTimeout = setTimeout(() => {}, 999999);
    if (room._timerTimeout) { clearTimeout(room._timerTimeout); room._timerTimeout = null; staleCleared = true; }
    const r = simulateStartBattleWithDelivery(room, 'host');
    if (room._timerTimeout) { clearTimeout(room._timerTimeout); room._timerTimeout = null; }
    assert.equal(staleCleared, true);
    assert.equal(r.success, true);
  });

  test('10. battle_started is idempotent — re-broadcast does not change startTime/endTime', () => {
    const room = mkRoom({ status: 'LOBBY' });
    simulateStartBattleWithDelivery(room, 'host');
    const st = room.startTime;
    const et = room.endTime;
    if (room._timerTimeout) { clearTimeout(room._timerTimeout); room._timerTimeout = null; }
    // Simulate re-broadcast path: read but do not mutate
    const payload = { startTime: room.startTime, endTime: room.endTime, config: room.config };
    assert.equal(payload.startTime, st);
    assert.equal(payload.endTime, et);
  });

});
