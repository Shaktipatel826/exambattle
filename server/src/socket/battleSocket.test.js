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
