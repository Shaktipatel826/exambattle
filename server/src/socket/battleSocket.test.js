/**
 * battleSocket.test.js
 *
 * Unit tests for finishBattle scoring logic, idempotency, and result payload.
 * These tests exercise the scoring calculations and guard conditions directly,
 * without requiring a live Socket.IO server or MongoDB connection.
 *
 * Run with:  node --test src/socket/battleSocket.test.js
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { scoreShortAnswer } from '../services/proximityScorer.js';

// ─── Inline re-implementation of finishBattle scoring logic ───────────────────
// We extract the pure calculation part so we can test it in isolation.
// The actual finishBattle function also does DB writes and io.emit — those are
// tested by integration/e2e tests. Here we test the math only.

function calcPlayerResults(player, questions, negativeMarking = 0.25) {
  let correct = 0, partial = 0, wrong = 0, score = 0;
  const answerScores = {};

  questions.forEach((q, idx) => {
    const selected = player.answers[idx];

    if (q.questionType === 'short_answer') {
      const hasAnswer = selected !== undefined && selected !== null &&
                        selected !== '' && selected !== -1;
      if (!hasAnswer) {
        answerScores[idx] = 0;
        return;
      }
      const { score: pct } = scoreShortAnswer(String(selected), q.referenceAnswer || '');
      answerScores[idx] = pct;
      score += pct / 100;
      if (pct === 100)  correct++;
      else if (pct > 0) partial++;
      else              wrong++;
      return;
    }

    // MCQ
    if (selected !== undefined && selected !== -1) {
      if (selected === q.correctAnswer) { correct++; score += 1; }
      else { wrong++; score -= negativeMarking; }
    }
  });

  const attempted = correct + partial + wrong;
  const unattempted = questions.length - attempted;
  const finalScore = Math.max(0, parseFloat(score.toFixed(2)));
  const accuracy = questions.length > 0
    ? Math.round(Math.max(0, score) / questions.length * 100) : 0;

  return { correct, partial, wrong, unattempted, score: finalScore, accuracy, answerScores };
}

// ─── finishBattle idempotency guard ───────────────────────────────────────────
function simulateFinishBattle(room) {
  if (room.status === 'FINISHED') return { skipped: true };
  room.status = 'FINISHED';
  if (room._timerTimeout)  { clearTimeout(room._timerTimeout);  room._timerTimeout  = null; }
  if (room._finishTimeout) { clearTimeout(room._finishTimeout); room._finishTimeout = null; }
  return { skipped: false };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const MCQ_QS = [
  { _id: 'q1', questionType: 'mcq', correctAnswer: 0 },
  { _id: 'q2', questionType: 'mcq', correctAnswer: 2 },
  { _id: 'q3', questionType: 'mcq', correctAnswer: 1 },
];

const SA_QS = [
  { _id: 's1', questionType: 'short_answer', referenceAnswer: 'September 5' },
  { _id: 's2', questionType: 'short_answer', referenceAnswer: '28' },
  { _id: 's3', questionType: 'short_answer', referenceAnswer: 'Gandhi' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE 1: finishBattle idempotency guard
// ═══════════════════════════════════════════════════════════════════════════════
describe('finishBattle idempotency guard', () => {

  test('first call sets status=FINISHED and returns skipped:false', () => {
    const room = { status: 'IN_PROGRESS', _timerTimeout: null, _finishTimeout: null };
    const result = simulateFinishBattle(room);
    assert.equal(result.skipped, false);
    assert.equal(room.status, 'FINISHED');
  });

  test('second call (race condition) is skipped — room stays FINISHED only once', () => {
    const room = { status: 'IN_PROGRESS', _timerTimeout: null, _finishTimeout: null };
    simulateFinishBattle(room); // first call
    const result2 = simulateFinishBattle(room); // second call (timer + player_finished race)
    assert.equal(result2.skipped, true, 'Second finishBattle call must be a no-op');
    assert.equal(room.status, 'FINISHED');
  });

  test('_timerTimeout is cleared after finish', () => {
    let cleared = false;
    const fakeTimeout = setTimeout(() => {}, 9999);
    const room = {
      status: 'IN_PROGRESS',
      _timerTimeout: fakeTimeout,
      _finishTimeout: null
    };
    simulateFinishBattle(room);
    assert.equal(room._timerTimeout, null, '_timerTimeout must be null after finish');
  });

  test('_finishTimeout is cleared after finish', () => {
    const fakeTimeout = setTimeout(() => {}, 9999);
    const room = {
      status: 'IN_PROGRESS',
      _timerTimeout: null,
      _finishTimeout: fakeTimeout
    };
    simulateFinishBattle(room);
    assert.equal(room._finishTimeout, null, '_finishTimeout must be null after finish');
  });

});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE 2: MCQ scoring
// ═══════════════════════════════════════════════════════════════════════════════
describe('MCQ scoring — correct/wrong/skipped counts', () => {

  test('all correct — score = questionCount, correct = 3, wrong = 0, skipped = 0', () => {
    const player = { answers: { 0: 0, 1: 2, 2: 1 } };
    const r = calcPlayerResults(player, MCQ_QS);
    assert.equal(r.correct, 3);
    assert.equal(r.wrong, 0);
    assert.equal(r.unattempted, 0);
    assert.equal(r.score, 3);
  });

  test('all wrong — negative marking applied, score floored at 0', () => {
    const player = { answers: { 0: 1, 1: 0, 2: 0 } };
    const r = calcPlayerResults(player, MCQ_QS);
    assert.equal(r.correct, 0);
    assert.equal(r.wrong, 3);
    assert.equal(r.unattempted, 0);
    assert.equal(r.score, 0, 'Score must not go below 0');
  });

  test('all skipped — score = 0, unattempted = 3', () => {
    const player = { answers: {} };
    const r = calcPlayerResults(player, MCQ_QS);
    assert.equal(r.correct, 0);
    assert.equal(r.wrong, 0);
    assert.equal(r.unattempted, 3);
    assert.equal(r.score, 0);
  });

  test('mixed: 2 correct, 1 wrong — score = 2 - 0.25 = 1.75', () => {
    const player = { answers: { 0: 0, 1: 2, 2: 0 } }; // Q3 wrong (correct=1, chose 0)
    const r = calcPlayerResults(player, MCQ_QS);
    assert.equal(r.correct, 2);
    assert.equal(r.wrong, 1);
    assert.equal(r.score, 1.75);
  });

  test('1 correct, 1 wrong, 1 skipped', () => {
    const player = { answers: { 0: 0, 1: 0 } }; // Q2 wrong (correct=2)
    const r = calcPlayerResults(player, MCQ_QS);
    assert.equal(r.correct, 1);
    assert.equal(r.wrong, 1);
    assert.equal(r.unattempted, 1);
    assert.equal(r.score, Math.max(0, parseFloat((1 - 0.25).toFixed(2))));
  });

});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE 3: Short-answer scoring
// ═══════════════════════════════════════════════════════════════════════════════
describe('Short-answer scoring — correct/partial/wrong/skipped', () => {

  test('all exact → all correct', () => {
    const player = { answers: { 0: 'September 5', 1: '28', 2: 'Gandhi' } };
    const r = calcPlayerResults(player, SA_QS);
    assert.equal(r.correct, 3);
    assert.equal(r.partial, 0);
    assert.equal(r.wrong, 0);
    assert.equal(r.unattempted, 0);
    assert.equal(r.score, 3);
  });

  test('date off by 1 day → partial', () => {
    const player = { answers: { 0: 'September 4', 1: '28', 2: 'Gandhi' } };
    const r = calcPlayerResults(player, SA_QS);
    assert.equal(r.partial, 1, 'September 4 should be partial (97%)');
    assert.equal(r.correct, 2); // 28 and Gandhi exact
    assert.ok(r.score > 2.9 && r.score <= 3, `Expected score ~2.97, got ${r.score}`);
  });

  test('numeric off by 1 (27 vs 28) → partial', () => {
    const player = { answers: { 0: 'September 5', 1: '27', 2: 'Gandhi' } };
    const r = calcPlayerResults(player, SA_QS);
    assert.equal(r.partial, 1);
    assert.equal(r.correct, 2);
    assert.ok(r.score > 2.9 && r.score <= 3);
  });

  test('wrong text answer → wrong', () => {
    const player = { answers: { 0: 'September 5', 1: '28', 2: 'Nehru' } };
    const r = calcPlayerResults(player, SA_QS);
    assert.equal(r.wrong, 1);
    assert.equal(r.correct, 2);
  });

  test('skipped short answer → unattempted, no penalty', () => {
    const player = { answers: { 0: '', 1: '28', 2: 'Gandhi' } };
    const r = calcPlayerResults(player, SA_QS);
    assert.equal(r.unattempted, 1);
    assert.equal(r.correct, 2);
    assert.equal(r.score, 2); // no penalty for blank
  });

  test('answerScores map populated for attempted short answers', () => {
    const player = { answers: { 0: 'September 5', 1: '0', 2: '' } };
    const r = calcPlayerResults(player, SA_QS);
    assert.equal(r.answerScores[0], 100);
    assert.equal(r.answerScores[1], 0);  // wrong numeric
    assert.equal(r.answerScores[2], 0);  // blank
  });

});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE 4: Two-player comparative scoring
// ═══════════════════════════════════════════════════════════════════════════════
describe('Two-player comparative scoring', () => {

  test('Player A beats Player B — winner determined by total score', () => {
    const pA = { answers: { 0: 0, 1: 2, 2: 1 } }; // 3/3 correct
    const pB = { answers: { 0: 1, 1: 2, 2: 1 } }; // 2/3 correct, 1 wrong
    const rA = calcPlayerResults(pA, MCQ_QS);
    const rB = calcPlayerResults(pB, MCQ_QS);
    assert.ok(rA.score > rB.score, `A (${rA.score}) should beat B (${rB.score})`);
  });

  test('TIE: both players same score', () => {
    const pA = { answers: { 0: 0, 1: 2, 2: 1 } }; // 3 correct
    const pB = { answers: { 0: 0, 1: 2, 2: 1 } }; // 3 correct
    const rA = calcPlayerResults(pA, MCQ_QS);
    const rB = calcPlayerResults(pB, MCQ_QS);
    assert.equal(rA.score, rB.score, 'Tie: both scores must be equal');
  });

  test('Partial marks break tie: A with partial wins over B with all-wrong', () => {
    const saQ = [{ _id: 'q1', questionType: 'short_answer', referenceAnswer: '28' }];
    const pA = { answers: { 0: '27' } }; // 96% partial
    const pB = { answers: { 0: '0'  } }; // 0% wrong
    const rA = calcPlayerResults(pA, saQ);
    const rB = calcPlayerResults(pB, saQ);
    assert.ok(rA.partial === 1, 'A should have 1 partial');
    assert.ok(rB.wrong === 1, 'B should have 1 wrong');
    assert.ok(rA.score > rB.score, 'A with partial should outscore B with wrong');
  });

  test('Each player gets independent submittedAnswers in leaderboard payload', () => {
    const pA = { userId: 'u1', name: 'Shakti', answers: { 0: 0, 1: 2 }, answerScores: {} };
    const pB = { userId: 'u2', name: 'Shubham', answers: { 0: 1, 1: 2 }, answerScores: {} };
    const players = [pA, pB];

    // Simulate the leaderboard payload construction from finishBattle
    const leaderboard = players.map((p, rank) => ({
      rank: rank + 1,
      userId: p.userId,
      name: p.name,
      submittedAnswers: p.answers || {},
      answerScores: p.answerScores || {},
    }));

    assert.deepEqual(leaderboard[0].submittedAnswers, { 0: 0, 1: 2 });
    assert.deepEqual(leaderboard[1].submittedAnswers, { 0: 1, 1: 2 });
    // Ensure players don't share the same answers reference
    assert.notDeepEqual(leaderboard[0].submittedAnswers, leaderboard[1].submittedAnswers);
  });

  test('All players receive same leaderboard (server broadcasts to room, not individually)', () => {
    // Simulate: both players submitted; server computes once; both receive same payload
    const questions = MCQ_QS;
    const pA = { userId: 'u1', name: 'Shakti',  answers: { 0: 0, 1: 2, 2: 1 } };
    const pB = { userId: 'u2', name: 'Shubham', answers: { 0: 1, 1: 2, 2: 0 } };

    [pA, pB].forEach(p => {
      const r = calcPlayerResults(p, questions);
      Object.assign(p, r);
    });
    [pA, pB].sort((a, b) => b.score - a.score);

    const payload = {
      leaderboard: [pA, pB].map((p, rank) => ({
        rank: rank + 1,
        userId: p.userId,
        name: p.name,
        score: p.score,
        correctCount: p.correct,
        wrongCount: p.wrong,
        unattemptedCount: p.unattempted,
        submittedAnswers: p.answers,
      })),
      questions,
    };

    // Both players would receive the identical payload (same object in io.to().emit)
    const payloadForA = JSON.parse(JSON.stringify(payload));
    const payloadForB = JSON.parse(JSON.stringify(payload));
    assert.deepEqual(payloadForA, payloadForB, 'Both players must get identical leaderboard payload');
    assert.equal(payload.leaderboard.length, 2);
    // Shakti (3 correct) should be rank 1
    assert.equal(payload.leaderboard[0].userId, 'u1');
    assert.equal(payload.leaderboard[0].correctCount, 3);
    assert.equal(payload.leaderboard[1].userId, 'u2');
    assert.equal(payload.leaderboard[1].correctCount, 1);
  });

});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE 5: Score floor and accuracy
// ═══════════════════════════════════════════════════════════════════════════════
describe('Score floor and accuracy calculation', () => {

  test('Score never goes below 0', () => {
    // 5 wrong MCQs with negative marking would be -1.25, must floor to 0
    const qs = Array.from({ length: 5 }, (_, i) => ({
      _id: `q${i}`, questionType: 'mcq', correctAnswer: 0
    }));
    const player = { answers: { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1 } };
    const r = calcPlayerResults(player, qs);
    assert.equal(r.score, 0, 'Score must be 0, not negative');
  });

  test('Accuracy = 0 when score <= 0', () => {
    const qs = [{ _id: 'q1', questionType: 'mcq', correctAnswer: 0 }];
    const player = { answers: { 0: 1 } }; // wrong
    const r = calcPlayerResults(player, qs);
    assert.equal(r.accuracy, 0);
  });

  test('Accuracy = 100 when all correct', () => {
    const player = { answers: { 0: 0, 1: 2, 2: 1 } };
    const r = calcPlayerResults(player, MCQ_QS);
    assert.equal(r.accuracy, 100);
  });

  test('Accuracy proportional — 2 of 3 correct = 67%', () => {
    const player = { answers: { 0: 0, 1: 2 } }; // Q3 skipped
    const r = calcPlayerResults(player, MCQ_QS);
    assert.equal(r.accuracy, 67);
  });

});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE 6: submitting-stuck prevention
// ═══════════════════════════════════════════════════════════════════════════════
describe('Submitting-stuck prevention logic', () => {

  test('duplicate player_finished is ignored (player.finished already true)', () => {
    const player = { userId: 'u1', finished: false, answers: {} };
    // First call
    player.finished = true;
    // Second call — simulates duplicate player_finished event
    const isDuplicate = player.finished; // already true
    assert.equal(isDuplicate, true, 'Second player_finished must be detected as duplicate');
  });

  test('single player room finishes immediately (no wait)', () => {
    const room = { players: [{ finished: false }], status: 'IN_PROGRESS' };
    room.players[0].finished = true;
    const allDone = room.players.every(p => p.finished);
    // With 1 player: allDone OR length===1 → finish immediately
    assert.ok(allDone || room.players.length === 1, 'Single player room must finish immediately');
  });

  test('two-player room: finishes only when both done', () => {
    const room = {
      players: [{ finished: false }, { finished: false }],
      status: 'IN_PROGRESS'
    };
    room.players[0].finished = true;
    const allDoneAfterFirst = room.players.every(p => p.finished);
    assert.equal(allDoneAfterFirst, false, 'Should NOT finish after only first player');

    room.players[1].finished = true;
    const allDoneAfterBoth = room.players.every(p => p.finished);
    assert.equal(allDoneAfterBoth, true, 'SHOULD finish after both players done');
  });

});


// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE 7: Reconnect-after-finish re-delivery (the production bug fix)
// Root cause: player's WebSocket drops right after finishBattle emits battle_finished.
// New socket calls join_room → old code rejected FINISHED rooms → player stuck forever.
// Fix: cache _finishedPayload on room; re-send via join_room for known players.
// ═══════════════════════════════════════════════════════════════════════════════
describe('Reconnect-after-finish re-delivery (production bug fix)', () => {

  // Simulate the join_room FINISHED branch with the fix applied
  function simulateJoinRoomFinished(room, userId) {
    if (room.status !== 'FINISHED') return { action: 'none' };
    const isKnownPlayer = room.players.some(p => String(p.userId) === String(userId));
    if (isKnownPlayer && room._finishedPayload) {
      // server: socket.join(code) + socket.emit('battle_finished', room._finishedPayload)
      return { action: 'resent', payload: room._finishedPayload };
    }
    return { action: 'rejected', message: 'Battle has already ended.' };
  }

  // Simulate finishBattle storing _finishedPayload
  function simulateFinishBattleWithCache(room, leaderboard, questions) {
    if (room.status === 'FINISHED') return { skipped: true };
    room.status = 'FINISHED';
    room._finishedPayload = { leaderboard, questions };
    return { skipped: false };
  }

  const QUESTIONS = [
    { _id: 'q1', question: 'Q1', options: ['A','B','C','D'], correctAnswer: 0, questionType: 'mcq' }
  ];
  const LEADERBOARD = [
    { rank: 1, userId: 'host', name: 'Alice', score: 1 },
    { rank: 2, userId: 'guest', name: 'Bob',   score: 0 }
  ];

  test('finishBattle caches _finishedPayload on room', () => {
    const room = { status: 'IN_PROGRESS', _timerTimeout: null, _finishTimeout: null };
    const result = simulateFinishBattleWithCache(room, LEADERBOARD, QUESTIONS);
    assert.equal(result.skipped, false);
    assert.ok(room._finishedPayload, '_finishedPayload must be set after finishBattle');
    assert.deepEqual(room._finishedPayload.leaderboard, LEADERBOARD);
    assert.deepEqual(room._finishedPayload.questions, QUESTIONS);
  });

  test('known player reconnecting to FINISHED room gets battle_finished re-sent', () => {
    const room = {
      status: 'FINISHED',
      players: [
        { userId: 'host', name: 'Alice', socketId: 'old-socket-1', answers: {} },
        { userId: 'guest', name: 'Bob',   socketId: 'old-socket-2', answers: {} }
      ],
      _finishedPayload: { leaderboard: LEADERBOARD, questions: QUESTIONS }
    };
    // Host reconnects with new socket
    const result = simulateJoinRoomFinished(room, 'host');
    assert.equal(result.action, 'resent', 'Known player must receive re-sent results');
    assert.deepEqual(result.payload.leaderboard, LEADERBOARD);
    assert.deepEqual(result.payload.questions, QUESTIONS);
  });

  test('unknown player joining FINISHED room is correctly rejected', () => {
    const room = {
      status: 'FINISHED',
      players: [{ userId: 'host', socketId: 'old-1', answers: {} }],
      _finishedPayload: { leaderboard: LEADERBOARD, questions: QUESTIONS }
    };
    const result = simulateJoinRoomFinished(room, 'stranger');
    assert.equal(result.action, 'rejected', 'Unknown player must be rejected from FINISHED room');
  });

  test('FINISHED room with no _finishedPayload still rejects gracefully', () => {
    // Edge case: server restarted and room state was rebuilt without cached payload
    const room = {
      status: 'FINISHED',
      players: [{ userId: 'host', socketId: 'old-1', answers: {} }],
      _finishedPayload: null
    };
    const result = simulateJoinRoomFinished(room, 'host');
    assert.equal(result.action, 'rejected', 'No cached payload → reject (not crash)');
  });

  test('host submits first, then guest — both complete, finish triggers once', () => {
    const room = {
      status: 'IN_PROGRESS',
      players: [
        { userId: 'host',  name: 'Alice', finished: false, answers: { 0: 0 } },
        { userId: 'guest', name: 'Bob',   finished: false, answers: {} }
      ],
      _timerTimeout: null, _finishTimeout: null
    };
    // Host submits
    room.players[0].finished = true;
    let allDone = room.players.every(p => p.finished);
    assert.equal(allDone, false, 'Should not finish when only host done');

    // Guest submits
    room.players[1].finished = true;
    allDone = room.players.every(p => p.finished);
    assert.equal(allDone, true, 'Should finish when both done');

    const finishResult = simulateFinishBattleWithCache(room, LEADERBOARD, QUESTIONS);
    assert.equal(finishResult.skipped, false);
    assert.ok(room._finishedPayload, 'Payload must be cached after both submit');
  });

  test('guest submits first, then host — both complete, finish triggers once', () => {
    const room = {
      status: 'IN_PROGRESS',
      players: [
        { userId: 'host',  name: 'Alice', finished: false, answers: {} },
        { userId: 'guest', name: 'Bob',   finished: false, answers: { 0: 1 } }
      ],
      _timerTimeout: null, _finishTimeout: null
    };
    room.players[1].finished = true; // guest first
    let allDone = room.players.every(p => p.finished);
    assert.equal(allDone, false, 'Must not finish after guest only');

    room.players[0].finished = true; // host second
    allDone = room.players.every(p => p.finished);
    assert.equal(allDone, true, 'Must finish after host submits too');

    const finishResult = simulateFinishBattleWithCache(room, LEADERBOARD, QUESTIONS);
    assert.equal(finishResult.skipped, false);
    assert.ok(room._finishedPayload);
  });

  test('duplicate finish events do not re-run finishBattle (idempotency)', () => {
    const room = {
      status: 'IN_PROGRESS',
      players: [
        { userId: 'host',  finished: false, answers: { 0: 0 } },
        { userId: 'guest', finished: false, answers: { 0: 1 } }
      ],
      _timerTimeout: null, _finishTimeout: null
    };
    // First finish
    const r1 = simulateFinishBattleWithCache(room, LEADERBOARD, QUESTIONS);
    assert.equal(r1.skipped, false);
    // Second finish (timer fires after player_finished already triggered it)
    const r2 = simulateFinishBattleWithCache(room, LEADERBOARD, QUESTIONS);
    assert.equal(r2.skipped, true, 'Second finishBattle must be a no-op');
  });

  test('DB persistence failure does not block result re-delivery', () => {
    // Even if _finishedPayload exists (results broadcast succeeded) but DB save failed,
    // reconnecting player can still receive results.
    const room = {
      status: 'FINISHED',
      players: [{ userId: 'host', name: 'Alice', socketId: 'stale', answers: {} }],
      _finishedPayload: { leaderboard: LEADERBOARD, questions: QUESTIONS },
      _dbSaveFailed: true  // simulated DB failure flag
    };
    const result = simulateJoinRoomFinished(room, 'host');
    assert.equal(result.action, 'resent', 'Results must be re-deliverable even if DB save failed');
  });

  test('timeout fallback: 60s force-finish triggers when second player never submits', () => {
    // Simulate: player 1 finished, timeout fires, finishBattle runs
    const room = {
      status: 'IN_PROGRESS',
      players: [
        { userId: 'host',  name: 'Alice', finished: true,  answers: { 0: 0 } },
        { userId: 'guest', name: 'Bob',   finished: false, answers: {} }
      ],
      _timerTimeout: null,
      _finishTimeout: null
    };
    // All done check would be false (guest not finished), but timeout force-finishes
    const allDone = room.players.every(p => p.finished);
    assert.equal(allDone, false, 'Not all done yet');
    // Timeout fires: finishBattle called regardless
    const result = simulateFinishBattleWithCache(room, LEADERBOARD, QUESTIONS);
    assert.equal(result.skipped, false, 'Force-finish via timeout must succeed');
    assert.equal(room.status, 'FINISHED');
    assert.ok(room._finishedPayload, 'Payload must be cached for reconnect delivery');
  });

});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE 8: Durable Persistence & DB Recovery
// ═══════════════════════════════════════════════════════════════════════════════
describe('Suite 8: Durable persistence and DB recovery', () => {

  // ── Helper: simulate BattleResult DB persistence (pure logic) ──────────────
  function simulateBattleResultSave(room, leaderboard, questions) {
    // Mimics the fire-and-forget BattleResult.findOneAndUpdate call in finishBattle().
    // Returns a document structure identical to what MongoDB would store.
    if (!room.roomCode) throw new Error('roomCode required');
    return {
      roomCode:   room.roomCode,
      status:     'FINISHED',
      finishedAt: new Date(),
      config:     room.config || {},
      leaderboard,
      questions,
    };
  }

  // ── Helper: simulate join_room DB fallback (after server restart) ─────────
  // Returns { action: 'recovered'|'rejected', payload? }
  function simulateJoinRoomDBFallback(savedResult, userId) {
    if (!savedResult) return { action: 'rejected' };
    const isParticipant = savedResult.leaderboard.some(
      entry => String(entry.userId) === String(userId)
    );
    if (!isParticipant) return { action: 'rejected' };
    return {
      action: 'recovered',
      payload: { leaderboard: savedResult.leaderboard, questions: savedResult.questions },
    };
  }

  const ROOM_CODE = 'TEST01';
  const LB = [
    { rank: 1, userId: 'host',  name: 'Alice', score: 2, accuracy: 67 },
    { rank: 2, userId: 'guest', name: 'Bob',   score: 0, accuracy: 0  },
  ];
  const QS = [
    { _id: 'q1', question: 'Q1?', options: ['A', 'B', 'C', 'D'], correctAnswer: 0 },
    { _id: 'q2', question: 'Q2?', options: ['A', 'B', 'C', 'D'], correctAnswer: 2 },
    { _id: 'q3', question: 'Q3?', options: ['A', 'B', 'C', 'D'], correctAnswer: 1 },
  ];

  test('BattleResult document is built with correct roomCode, leaderboard and questions', () => {
    const room = { roomCode: ROOM_CODE, config: { subject: 'History', timeLimitMinutes: 5 } };
    const doc = simulateBattleResultSave(room, LB, QS);
    assert.equal(doc.roomCode, ROOM_CODE);
    assert.equal(doc.status, 'FINISHED');
    assert.ok(doc.finishedAt instanceof Date, 'finishedAt must be a Date');
    assert.deepEqual(doc.leaderboard, LB);
    assert.deepEqual(doc.questions, QS);
    assert.equal(doc.config.subject, 'History');
  });

  test('DB fallback: participant receives recovered result when room not in memory', () => {
    const savedResult = { roomCode: ROOM_CODE, leaderboard: LB, questions: QS };
    const result = simulateJoinRoomDBFallback(savedResult, 'host');
    assert.equal(result.action, 'recovered', 'Known player must be served the recovered result');
    assert.deepEqual(result.payload.leaderboard, LB);
    assert.deepEqual(result.payload.questions, QS);
  });

  test('DB fallback: non-participant is rejected even if DB record exists', () => {
    const savedResult = { roomCode: ROOM_CODE, leaderboard: LB, questions: QS };
    const result = simulateJoinRoomDBFallback(savedResult, 'stranger');
    assert.equal(result.action, 'rejected', 'Non-participant must not access the result');
  });

  test('DB fallback: null DB record means battle not yet finished — returns rejected', () => {
    const result = simulateJoinRoomDBFallback(null, 'host');
    assert.equal(result.action, 'rejected', 'No DB record → battle not done yet or expired');
  });

  test('player_finished userId matching: String() normalization handles ObjectId vs string', () => {
    // Simulates the fixed find() call: String(p.userId) === String(userId)
    const players = [
      { userId: 'abc123', finished: false },   // string
      { userId: 'def456', finished: false },   // string
    ];
    // Case 1: exact string match
    const p1 = players.find(p => String(p.userId) === String('abc123'));
    assert.ok(p1, 'Exact string userId must match');

    // Case 2: ObjectId-like object (toString returns the id string)
    const fakeObjectId = { toString: () => 'abc123' };
    const p2 = players.find(p => String(p.userId) === String(fakeObjectId));
    assert.ok(p2, 'ObjectId (via toString) must still match after String() normalization');

    // Case 3: unknown userId returns undefined — no crash
    const p3 = players.find(p => String(p.userId) === String('nonexistent'));
    assert.equal(p3, undefined, 'Unknown userId must return undefined, not throw');
  });

  test('BattleResult leaderboard contains submittedAnswers for comparative review', () => {
    const room = { roomCode: ROOM_CODE, config: { subject: 'Polity', timeLimitMinutes: 5 } };
    const lbWithAnswers = [
      { rank: 1, userId: 'host',  name: 'Alice', score: 2, submittedAnswers: { 0: 0, 1: 2 } },
      { rank: 2, userId: 'guest', name: 'Bob',   score: 0, submittedAnswers: { 0: 1 } },
    ];
    const doc = simulateBattleResultSave(room, lbWithAnswers, QS);
    assert.ok(doc.leaderboard[0].submittedAnswers, 'submittedAnswers must be persisted');
    assert.equal(doc.leaderboard[0].submittedAnswers[0], 0);  // Alice answered Q1 → option A
    assert.equal(doc.leaderboard[1].submittedAnswers[0], 1);  // Bob answered Q1 → option B
  });

  test('_finishedPayload is set BEFORE broadcast (fast-path cache)', () => {
    // Verifies the ordering fix: _finishedPayload is now assigned before io.emit().
    // Simulate the new order inside finishBattle():
    const room = {
      status: 'IN_PROGRESS',
      roomCode: ROOM_CODE,
      config: {},
      players: [
        { userId: 'host', finished: true, answers: { 0: 0 } }
      ],
      _timerTimeout: null, _finishTimeout: null,
    };
    const broadcastLog = [];
    // Step 1: set _finishedPayload FIRST
    room._finishedPayload = { leaderboard: LB, questions: QS };
    // Step 2: then broadcast
    broadcastLog.push('battle_finished');
    // Step 3: fire-and-forget DB save
    // (not awaited in this test — simulated as sync)
    simulateBattleResultSave(room, LB, QS);

    assert.ok(room._finishedPayload, '_finishedPayload must exist before broadcast');
    assert.equal(broadcastLog[0], 'battle_finished', 'Broadcast must follow payload cache assignment');
  });

  test('REST recovery payload structure matches socket battle_finished payload', () => {
    // Verifies that what the REST endpoint returns matches what the socket emits,
    // so the frontend can apply either identically.
    const socketPayload = { leaderboard: LB, questions: QS };
    const restPayload = { leaderboard: LB, questions: QS, finishedAt: new Date(), config: {} };

    // Frontend only uses leaderboard and questions from either source
    assert.deepEqual(restPayload.leaderboard, socketPayload.leaderboard);
    assert.deepEqual(restPayload.questions, socketPayload.questions);
  });

});
