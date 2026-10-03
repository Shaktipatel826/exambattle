import { io } from '../../../client/node_modules/socket.io-client/build/esm/index.js';

const BASE_URL = 'http://localhost:5000/api';
const SOCKET_URL = 'http://localhost:5000';

async function runPhase6Tests() {
  console.log('=== Starting Phase 6 Student Test Engine & Multiplayer Battle Verification Suite ===\n');

  try {
    // 1. Log in Student 1
    console.log('1. Logging in Student 1 (student@shakti.com)...');
    const s1Res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'student@shakti.com', password: 'student123', role: 'STUDENT' })
    });
    const s1Login = await s1Res.json();
    if (!s1Login.token) throw new Error('Student 1 login failed: ' + JSON.stringify(s1Login));
    const token1 = s1Login.token;
    const user1 = s1Login.user;
    console.log(`✔ Student 1 logged in (${user1.name}, ID: ${user1.id || user1._id}).`);

    // 2. Log in Student 2
    console.log('\n2. Logging in Student 2 (demo student)...');
    const s2Res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'student@shakti.com', password: 'student123', role: 'STUDENT' })
    });
    const s2Login = await s2Res.json();
    const user2 = { id: 'student_user_2', name: 'Rohan Sharma' };
    console.log(`✔ Student 2 configured (${user2.name}).`);

    // 3. Log in Student 3
    const user3 = { id: 'student_user_3', name: 'Priya Verma' };
    const user4 = { id: 'student_user_4', name: 'Extra Player' };

    // --- PART A: SOLO TEST ENGINE TESTS ---
    console.log('\n--- PART A: SOLO TEST ENGINE TESTS ---');

    console.log('A1. Creating Solo Test (/api/tests/create)...');
    const createTestRes = await fetch(`${BASE_URL}/tests/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token1}`
      },
      body: JSON.stringify({
        subject: 'General Studies',
        questionCount: 5,
        mode: 'SOLO'
      })
    });
    const testData = await createTestRes.json();
    if (!testData.success || !testData.test || !testData.test.questions) {
      throw new Error('Solo test creation failed: ' + JSON.stringify(testData));
    }
    const questions = testData.test.questions;
    console.log(`✔ Test created with ${questions.length} questions.`);

    // SECURITY CHECK: Verify answer key is NOT exposed before submission
    console.log('A2. Verifying answer key privacy (correctAnswer & explanation omitted)...');
    for (const q of questions) {
      if (q.correctAnswer !== undefined) {
        throw new Error(`SECURITY VIOLATION: Question ${q._id} leaked correctAnswer before submission!`);
      }
      if (q.explanation) {
        throw new Error(`SECURITY VIOLATION: Question ${q._id} leaked explanation before submission!`);
      }
    }
    console.log('✔ SECURITY PASSED: No answer key leaked to client before submission.');

    // Submit Test & Server Scoring
    console.log('A3. Submitting test answers (/api/tests/submit)...');
    const submitRes = await fetch(`${BASE_URL}/tests/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token1}`
      },
      body: JSON.stringify({
        testType: 'SOLO',
        subject: 'General Studies',
        answers: questions.map((q, idx) => ({
          questionId: q._id,
          selectedOption: idx % 2 === 0 ? 0 : 1,
          timeTakenSeconds: 10
        }))
      })
    });
    const submitData = await submitRes.json();
    if (!submitData.success || !submitData.result || submitData.result.attemptId === undefined) {
      throw new Error('Test submission failed: ' + JSON.stringify(submitData));
    }
    const result = submitData.result;
    console.log(`✔ Test scored server-side! Score: ${result.score}, Accuracy: ${result.accuracy}%, Total: ${result.totalQuestions}`);

    // Verify Attempt History
    console.log('A4. Verifying attempt history endpoint (/api/tests/history)...');
    const historyRes = await fetch(`${BASE_URL}/tests/history`, {
      headers: { Authorization: `Bearer ${token1}` }
    });
    const historyData = await historyRes.json();
    if (!historyData.success || historyData.attempts.length === 0) {
      throw new Error('Attempt history check failed: ' + JSON.stringify(historyData));
    }
    console.log(`✔ Attempt history retrieved (${historyData.attempts.length} records).`);

    // Verify Attempt Review Detail
    console.log('A5. Verifying single attempt detail review (/api/tests/history/:attemptId)...');
    const attemptId = historyData.attempts[0]._id;
    const detailRes = await fetch(`${BASE_URL}/tests/history/${attemptId}`, {
      headers: { Authorization: `Bearer ${token1}` }
    });
    const detailData = await detailRes.json();
    if (!detailData.success || !detailData.questionReviews) {
      throw new Error('Attempt detail review failed: ' + JSON.stringify(detailData));
    }
    console.log(`✔ Attempt detail review PASSED. Question reviews count: ${detailData.questionReviews.length}`);

    // --- PART B & C: MULTIPLAYER REALTIME BATTLE TESTS ---
    console.log('\n--- PART B & C: REALTIME BATTLE MULTIPLAYER TESTS ---');

    // Create Sockets
    const socket1 = io(SOCKET_URL);
    const socket2 = io(SOCKET_URL);
    const socket3 = io(SOCKET_URL);
    const socket4 = io(SOCKET_URL);

    let roomCode = null;

    // B1. Host creates room
    console.log('B1. Host creating battle room via Socket.io...');
    await new Promise((resolve, reject) => {
      socket1.emit('create_room', {
        user: { id: user1.id || user1._id, name: user1.name },
        config: { subject: 'General Studies', questionCount: 3, timeLimitMinutes: 5 }
      }, (res) => {
        if (!res.success) return reject(new Error('Room creation failed: ' + res.message));
        roomCode = res.roomCode;
        console.log(`✔ Room created successfully! 6-Character Room Code: [${roomCode}]`);
        resolve();
      });
    });

    // B2. Player 2 joins room
    console.log(`B2. Player 2 (${user2.name}) joining room [${roomCode}]...`);
    await new Promise((resolve, reject) => {
      socket2.emit('join_room', { roomCode, user: user2 }, (res) => {
        if (!res.success) return reject(new Error('Player 2 join failed: ' + res.message));
        console.log(`✔ Player 2 joined room. Total players: ${res.room.players.length}`);
        resolve();
      });
    });

    // B3. Player 3 joins room
    console.log(`B3. Player 3 (${user3.name}) joining room [${roomCode}]...`);
    await new Promise((resolve, reject) => {
      socket3.emit('join_room', { roomCode, user: user3 }, (res) => {
        if (!res.success) return reject(new Error('Player 3 join failed: ' + res.message));
        console.log(`✔ Player 3 joined room. Total players: ${res.room.players.length}`);
        resolve();
      });
    });

    // B4. Enforce Max Capacity (4th player MUST be rejected)
    console.log('B4. Testing Room Capacity Enforcement (Player 4 attempting to join)...');
    await new Promise((resolve, reject) => {
      socket4.emit('join_room', { roomCode, user: user4 }, (res) => {
        if (res.success) {
          return reject(new Error('SECURITY VIOLATION: Room accepted 4th player despite capacity limit of 3!'));
        }
        console.log(`✔ Capacity Enforcement PASSED. Player 4 rejected: "${res.message}"`);
        resolve();
      });
    });

    // B5. Toggle Ready State
    console.log('B5. Testing Toggle Ready State...');
    await new Promise((resolve, reject) => {
      socket2.emit('toggle_ready', { roomCode, userId: user2.id }, (res) => {
        if (!res.success || !res.isReady) return reject(new Error('Toggle ready failed'));
        console.log('✔ Player 2 ready state toggled to TRUE.');
        resolve();
      });
    });

    // B6. Synchronized Battle Start
    console.log('B6. Host starting battle synchronously...');
    let liveQuestions = [];
    const battleStartedPromise = new Promise((resolve) => {
      socket2.on('battle_started', (payload) => {
        liveQuestions = payload.questions;
        resolve(payload);
      });
    });

    await new Promise((resolve, reject) => {
      socket1.emit('start_battle', { roomCode, userId: user1.id || user1._id }, (res) => {
        if (!res.success) return reject(new Error('Start battle failed: ' + res.message));
        resolve();
      });
    });

    const startPayload = await battleStartedPromise;
    console.log(`✔ Battle started synchronously! Received ${startPayload.questions.length} questions.`);

    // Check Live Answer Key Privacy
    for (const q of startPayload.questions) {
      if (q.correctAnswer !== undefined || q.explanation) {
        throw new Error('SECURITY VIOLATION: Live battle leaked answer keys before completion!');
      }
    }
    console.log('✔ Live battle answer key privacy VERIFIED.');

    // B7. Submit Answers & Server-Side Battle Finish
    console.log('B7. Players submitting answers & server computing final score...');
    const battleFinishedPromise = new Promise((resolve) => {
      socket1.on('battle_finished', (data) => {
        resolve(data);
      });
    });

    // Submit answers for Player 1, 2, 3
    socket1.emit('submit_answer', { roomCode, userId: user1.id || user1._id, questionIndex: 0, selectedOptionIndex: 0 });
    socket1.emit('submit_answer', { roomCode, userId: user1.id || user1._id, questionIndex: 1, selectedOptionIndex: 1 });
    socket1.emit('submit_answer', { roomCode, userId: user1.id || user1._id, questionIndex: 2, selectedOptionIndex: 2 });

    socket2.emit('submit_answer', { roomCode, userId: user2.id, questionIndex: 0, selectedOptionIndex: 0 });
    socket2.emit('submit_answer', { roomCode, userId: user2.id, questionIndex: 1, selectedOptionIndex: 0 });
    socket2.emit('submit_answer', { roomCode, userId: user2.id, questionIndex: 2, selectedOptionIndex: 0 });

    socket3.emit('submit_answer', { roomCode, userId: user3.id, questionIndex: 0, selectedOptionIndex: 1 });
    socket3.emit('submit_answer', { roomCode, userId: user3.id, questionIndex: 1, selectedOptionIndex: 1 });
    socket3.emit('submit_answer', { roomCode, userId: user3.id, questionIndex: 2, selectedOptionIndex: 1 });

    const finishData = await battleFinishedPromise;
    if (!finishData || !finishData.leaderboard || finishData.leaderboard.length < 3) {
      throw new Error('Battle finish failed: ' + JSON.stringify(finishData));
    }
    console.log('✔ Battle finished successfully! Final Leaderboard:');
    finishData.leaderboard.forEach(p => {
      console.log(`   Rank ${p.rank}: ${p.name} - Score: ${p.score}, Accuracy: ${p.accuracy}%, Correct: ${p.correctCount}`);
    });

    // Clean up sockets
    socket1.disconnect();
    socket2.disconnect();
    socket3.disconnect();
    socket4.disconnect();

    console.log('\n=== ALL PHASE 6 SOLO TEST & MULTIPLAYER BATTLE TESTS PASSED 100% ===');
  } catch (err) {
    console.error('\n❌ PHASE 6 TEST FAILURE:', err.message);
    process.exit(1);
  }
}

runPhase6Tests();
