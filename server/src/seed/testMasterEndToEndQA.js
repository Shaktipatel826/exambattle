import { io as ioClient } from '../../../client/node_modules/socket.io-client/build/esm/index.js';
import { splitTextIntoLogicalChunks } from '../services/ai/chunkProcessor.js';
import { validateMCQSchema } from '../services/ai/contentParser.js';

const BASE_URL = 'http://localhost:5000/api';
const SOCKET_URL = 'http://localhost:5000';

async function runMasterEndToEndQA() {
  console.log('=============================================================');
  console.log('      EXAMIQ PLATFORM - FINAL END-TO-END QA & STABILITY SUITE');
  console.log('=============================================================\n');

  let testsPerformed = 0;
  let testsPassed = 0;
  let testsFailed = 0;
  const bugsFound = [];

  const assertTest = (name, passed, detail = '') => {
    testsPerformed++;
    if (passed) {
      testsPassed++;
      console.log(`[PASS ${testsPerformed}] ${name}`);
    } else {
      testsFailed++;
      bugsFound.push({ name, detail });
      console.error(`[FAIL ${testsPerformed}] ${name} - ${detail}`);
    }
  };

  try {
    // -------------------------------------------------------------
    // 1. AUTHENTICATION & SECURITY ISOLATION
    // -------------------------------------------------------------
    console.log('--- 1. AUTHENTICATION & SECURITY ISOLATION ---');

    // Admin Login
    const adminLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@shakti.com', password: 'admin123', role: 'ADMIN' })
    });
    const adminData = await adminLoginRes.json();
    const adminToken = adminData.token;
    assertTest('Admin Authentication Login', !!adminToken, JSON.stringify(adminData));

    // Student Login
    const studentLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'student@shakti.com', password: 'student123', role: 'STUDENT' })
    });
    const studentData = await studentLoginRes.json();
    const studentToken = studentData.token;
    assertTest('Student Authentication Login', !!studentToken, JSON.stringify(studentData));

    // Security: Student blocked from admin route
    const secAdminRes = await fetch(`${BASE_URL}/admin/stats`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assertTest('Security Guard: Student Blocked from Admin Stats (403)', secAdminRes.status === 403, `Status: ${secAdminRes.status}`);

    // Security: Student blocked from taxonomy modification
    const secTaxRes = await fetch(`${BASE_URL}/admin/subjects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`
      },
      body: JSON.stringify({ name: 'Unauthorized Subject' })
    });
    assertTest('Security Guard: Student Blocked from Taxonomy Mutation (403)', secTaxRes.status === 403, `Status: ${secTaxRes.status}`);

    // -------------------------------------------------------------
    // 2. STUDENT JOURNEY & SOLO TEST ENGINE
    // -------------------------------------------------------------
    console.log('\n--- 2. STUDENT JOURNEY & SOLO TEST ENGINE ---');

    // Student Dashboard
    const dashRes = await fetch(`${BASE_URL}/student/dashboard`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    const dashData = await dashRes.json();
    assertTest('Student Dashboard Retrieval', dashData.success && !!dashData.dashboard, JSON.stringify(dashData));

    // Dynamic Taxonomy Retrieval
    const taxRes = await fetch(`${BASE_URL}/taxonomy/managed`);
    const taxData = await taxRes.json();
    assertTest('Student Dynamic Taxonomy Retrieval', taxData.success && Array.isArray(taxData.subjects), JSON.stringify(taxData));

    // Solo Test Creation
    const createTestRes = await fetch(`${BASE_URL}/tests/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`
      },
      body: JSON.stringify({
        subject: 'Indian Polity',
        questionCount: 5,
        mode: 'SOLO'
      })
    });
    const testData = await createTestRes.json();
    assertTest('Solo Test Creation', testData.success && Array.isArray(testData.test.questions), JSON.stringify(testData));

    // Security Check: Answer key privacy before submission
    let keyLeaked = false;
    if (testData.test && testData.test.questions) {
      keyLeaked = testData.test.questions.some(q => q.correctAnswer !== undefined || q.explanation);
    }
    assertTest('Security Check: Answer Key Privacy Before Test Submission', !keyLeaked, 'Leaked answer key in test payload');

    // Solo Test Submission
    const answers = (testData.test.questions || []).map((q, idx) => ({
      questionId: q._id,
      selectedOption: idx % 4
    }));
    const submitTestRes = await fetch(`${BASE_URL}/tests/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`
      },
      body: JSON.stringify({
        testType: 'SOLO',
        subject: 'Indian Polity',
        answers,
        timeTakenSeconds: 45
      })
    });
    const submitResult = await submitTestRes.json();
    assertTest('Server-Side Solo Test Scoring & Result Generation', submitResult.success && submitResult.result.score !== undefined, JSON.stringify(submitResult));

    // Test History
    const historyRes = await fetch(`${BASE_URL}/tests/history`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    const historyData = await historyRes.json();
    assertTest('Student Attempt History Retrieval', historyData.success && Array.isArray(historyData.attempts), JSON.stringify(historyData));

    // Spaced Revision Summary
    const revRes = await fetch(`${BASE_URL}/student/revision`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    const revData = await revRes.json();
    assertTest('Spaced Revision Summary Queue Retrieval', revData.success && !!revData.revisionSummary, JSON.stringify(revData));

    // Mistake Book Retrieval
    const mistakeRes = await fetch(`${BASE_URL}/student/mistakes`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    const mistakeData = await mistakeRes.json();
    assertTest('Mistake Book Collection Retrieval', mistakeData.success && Array.isArray(mistakeData.mistakeBook), JSON.stringify(mistakeData));

    // Weak Topic Analysis with Sample Size Guard
    const weakRes = await fetch(`${BASE_URL}/student/weak-topics`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    const weakData = await weakRes.json();
    assertTest('Weak Topic Analysis with Sample Guard', weakData.success && Array.isArray(weakData.topicAnalysis), JSON.stringify(weakData));

    // Public Leaderboard Privacy Check
    const lbRes = await fetch(`${BASE_URL}/student/leaderboard`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    const lbData = await lbRes.json();
    let emailExposed = false;
    if (lbData.leaderboard) {
      emailExposed = lbData.leaderboard.some(e => e.email || e.password || e.hash);
    }
    assertTest('Security Check: Public Leaderboard Email/Hash Privacy Isolation', lbData.success && !emailExposed, JSON.stringify(lbData));

    // -------------------------------------------------------------
    // 3. ADMIN JOURNEY & CONTENT MANAGEMENT
    // -------------------------------------------------------------
    console.log('\n--- 3. ADMIN JOURNEY & CONTENT MANAGEMENT ---');

    // Admin Stats
    const statsRes = await fetch(`${BASE_URL}/admin/stats`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const statsData = await statsRes.json();
    assertTest('Admin Dashboard Statistics Retrieval', statsData.success && !!statsData.stats, JSON.stringify(statsData));

    // Create Subject
    const subName = `QA Test Subject_${Date.now()}`;
    const createSubRes = await fetch(`${BASE_URL}/admin/subjects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ name: subName, code: 'QA_SUB', description: 'End-to-End QA' })
    });
    const createSubData = await createSubRes.json();
    assertTest('Admin Subject Creation', createSubData.success && !!createSubData.subject, JSON.stringify(createSubData));

    // Duplicate Subject Guard
    const dupSubRes = await fetch(`${BASE_URL}/admin/subjects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ name: subName })
    });
    assertTest('Admin Duplicate Subject Protection (400)', dupSubRes.status === 400, `Status: ${dupSubRes.status}`);

    // Create Exam
    const examName = `QA Test Exam_${Date.now()}`;
    const createExamRes = await fetch(`${BASE_URL}/admin/exams`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ name: examName, shortName: 'QA Exam', category: 'Other' })
    });
    const createExamData = await createExamRes.json();
    assertTest('Admin Exam Creation', createExamData.success && !!createExamData.exam, JSON.stringify(createExamData));

    // Create Manual Question
    const manualQRes = await fetch(`${BASE_URL}/questions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        question: `QA Verified Question ${Date.now()}?`,
        options: ['Option A', 'Option B', 'Option C', 'Option D'],
        correctAnswer: 0,
        explanation: 'QA Explanation',
        subject: subName,
        topic: 'QA Topic',
        difficulty: 'Easy'
      })
    });
    const manualQData = await manualQRes.json();
    assertTest('Admin Manual Question Creation & Auto-Publish', manualQData.success && manualQData.question.status === 'PUBLISHED', JSON.stringify(manualQData));

    // Question Edit & Version History Audit Trail
    const createdQId = manualQData.question._id;
    const editQRes = await fetch(`${BASE_URL}/questions/${createdQId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        explanation: 'Updated QA Explanation with Version History'
      })
    });
    const editQData = await editQRes.json();
    assertTest('Question Edit & Version History Audit Trail', editQData.success && editQData.question.versionHistory.length > 0, JSON.stringify(editQData));

    // Bulk Import API
    const bulkRes = await fetch(`${BASE_URL}/import/bulk-questions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        questions: [
          {
            question: `Bulk QA Question 1_${Date.now()}?`,
            options: ['A', 'B', 'C', 'D'],
            correctAnswer: 1,
            explanation: 'Bulk Explanation 1',
            subject: 'History',
            topic: 'Modern History'
          }
        ]
      })
    });
    const bulkData = await bulkRes.json();
    assertTest('Bulk Question Import Pipeline', bulkData.success && bulkData.summary.valid > 0, JSON.stringify(bulkData));

    // -------------------------------------------------------------
    // 4. LARGE FILE & CHUNKING PROCESSOR TEST
    // -------------------------------------------------------------
    console.log('\n--- 4. LARGE FILE & CHUNKING PROCESSOR TEST ---');

    const sampleLongText = `
      Paragraph 1: The Constitution of India is the supreme law of India. The document lays down the framework that demarcates fundamental political code, structure, procedures, powers, and duties of government institutions and sets out fundamental rights, directive principles, and the duties of citizens.
      
      Paragraph 2: It is the longest written national constitution in the world. B. R. Ambedkar, chairman of the drafting committee, is widely considered to be its chief architect. It was adopted by the Constituent Assembly of India on 26 November 1949 and became effective on 26 January 1950.
      
      Paragraph 3: The constitution replaced the Government of India Act 1935 as the country's fundamental governing document, and the Dominion of India became the Republic of India. To ensure constitutional autochthony, its framers repealed prior acts of the British parliament in Article 395.
    `.repeat(15);

    const chunks = splitTextIntoLogicalChunks(sampleLongText, 2000);
    assertTest('Large Text Logical Paragraph Chunking Processor', chunks.length > 1, `Total Chunks: ${chunks.length}`);

    const schemaTest = validateMCQSchema({
      question: 'Which article declares India a Sovereign Republic?',
      options: ['Article 1', 'Article 14', 'Article 21', 'Article 32'],
      correct_answer: 'A',
      explanation: 'Article 1 states India, that is Bharat, shall be a Union of States.'
    });
    assertTest('AI MCQ Output Schema Validator & Parsing', schemaTest && schemaTest.correctAnswer === 0, JSON.stringify(schemaTest));

    // -------------------------------------------------------------
    // 5. REALTIME MULTIPLAYER BATTLE SIMULATION
    // -------------------------------------------------------------
    console.log('\n--- 5. REALTIME MULTIPLAYER BATTLE SIMULATION ---');

    const hostSocket = ioClient(SOCKET_URL, { transports: ['websocket'] });
    const p2Socket = ioClient(SOCKET_URL, { transports: ['websocket'] });
    const p3Socket = ioClient(SOCKET_URL, { transports: ['websocket'] });

    await new Promise(resolve => setTimeout(resolve, 500));

    let roomCode = null;
    await new Promise(resolve => {
      hostSocket.emit('create_room', {
        user: { id: 'host_qa_1', name: 'QA Host' },
        config: { subject: 'Polity', questionCount: 3 }
      }, (res) => {
        if (res.success) roomCode = res.roomCode;
        resolve();
      });
    });
    assertTest('Multiplayer Room Creation & 6-Char Code Generation', !!roomCode && roomCode.length === 6, `Room Code: ${roomCode}`);

    let p2Joined = false;
    await new Promise(resolve => {
      p2Socket.emit('join_room', { roomCode, user: { id: 'p2_qa_2', name: 'QA Player 2' } }, (res) => {
        p2Joined = res.success;
        resolve();
      });
    });
    assertTest('Player 2 Join Room', p2Joined);

    let p3Joined = false;
    await new Promise(resolve => {
      p3Socket.emit('join_room', { roomCode, user: { id: 'p3_qa_3', name: 'QA Player 3' } }, (res) => {
        p3Joined = res.success;
        resolve();
      });
    });
    assertTest('Player 3 Join Room (3-Player Battle)', p3Joined);

    // Capacity test (Player 4 blocked)
    const p4Socket = ioClient(SOCKET_URL, { transports: ['websocket'] });
    await new Promise(resolve => setTimeout(resolve, 300));
    let p4Rejected = false;
    await new Promise(resolve => {
      p4Socket.emit('join_room', { roomCode, user: { id: 'p4_qa_4', name: 'QA Player 4' } }, (res) => {
        p4Rejected = !res.success && res.message.includes('full');
        resolve();
      });
    });
    assertTest('Multiplayer Room Capacity Enforcement (Cap at 3)', p4Rejected);
    p4Socket.disconnect();

    // Start Battle & Verify Synchronized Payload Privacy
    let battleStarted = false;
    let questionsPrivate = false;
    await new Promise(resolve => {
      hostSocket.on('battle_started', (payload) => {
        battleStarted = true;
        questionsPrivate = payload.questions.every(q => q.correctAnswer === undefined && !q.explanation);
        resolve();
      });
      hostSocket.emit('start_battle', { roomCode, userId: 'host_qa_1' });
    });
    assertTest('Synchronized Battle Start & Live Answer Privacy', battleStarted && questionsPrivate);

    // Submit Answers & Verify Server Scoring
    let battleFinished = false;
    let finalScores = [];
    await new Promise(resolve => {
      hostSocket.on('battle_finished', (payload) => {
        battleFinished = true;
        finalScores = payload.leaderboard;
        resolve();
      });

      hostSocket.emit('submit_answer', { roomCode, userId: 'host_qa_1', questionIndex: 0, selectedOptionIndex: 0 });
      hostSocket.emit('submit_answer', { roomCode, userId: 'host_qa_1', questionIndex: 1, selectedOptionIndex: 1 });
      hostSocket.emit('submit_answer', { roomCode, userId: 'host_qa_1', questionIndex: 2, selectedOptionIndex: 2 });

      p2Socket.emit('submit_answer', { roomCode, userId: 'p2_qa_2', questionIndex: 0, selectedOptionIndex: 0 });
      p2Socket.emit('submit_answer', { roomCode, userId: 'p2_qa_2', questionIndex: 1, selectedOptionIndex: 0 });
      p2Socket.emit('submit_answer', { roomCode, userId: 'p2_qa_2', questionIndex: 2, selectedOptionIndex: 0 });

      p3Socket.emit('submit_answer', { roomCode, userId: 'p3_qa_3', questionIndex: 0, selectedOptionIndex: 1 });
      p3Socket.emit('submit_answer', { roomCode, userId: 'p3_qa_3', questionIndex: 1, selectedOptionIndex: 1 });
      p3Socket.emit('submit_answer', { roomCode, userId: 'p3_qa_3', questionIndex: 2, selectedOptionIndex: 1 });
    });

    assertTest('Realtime Battle Final Scoring & Leaderboard Broadcast', battleFinished && finalScores.length === 3);

    hostSocket.disconnect();
    p2Socket.disconnect();
    p3Socket.disconnect();

    console.log('\n=============================================================');
    console.log(`SUMMARY: ${testsPerformed} Tests Performed | ${testsPassed} Passed | ${testsFailed} Failed`);
    console.log('=============================================================\n');

    if (testsFailed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ MASTER QA SUITE EXCEPTION:');
    console.error(error);
    process.exit(1);
  }
}

runMasterEndToEndQA();
