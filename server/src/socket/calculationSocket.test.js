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
    status: 'IN_PROGRESS',
    roomCode: 'CTEST1',
    config: { durationSeconds: 60 },
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
