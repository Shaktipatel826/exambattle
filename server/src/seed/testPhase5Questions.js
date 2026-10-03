const BASE_URL = 'http://localhost:5000/api';

async function runPhase5Tests() {
  console.log('=== Starting Phase 5 Question Bank & Admin Review Verification Suite ===\n');

  try {
    // 1. Login Admin
    console.log('1. Logging in as Admin (admin@shakti.com)...');
    const adminLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@shakti.com', password: 'admin123', role: 'ADMIN' })
    });
    const adminLogin = await adminLoginRes.json();
    if (!adminLogin.token) throw new Error('Admin login failed: ' + JSON.stringify(adminLogin));
    const adminToken = adminLogin.token;
    console.log('✔ Admin login successful.');

    // 2. Login Student
    console.log('\n2. Logging in as Student (student@shakti.com)...');
    const studentLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'student@shakti.com', password: 'student123', role: 'STUDENT' })
    });
    const studentLogin = await studentLoginRes.json();
    if (!studentLogin.token) throw new Error('Student login failed: ' + JSON.stringify(studentLogin));
    const studentToken = studentLogin.token;
    console.log('✔ Student login successful.');

    // 3. Admin creates a new manual question
    console.log('\n3. Creating manual question as Admin...');
    const createQRes = await fetch(`${BASE_URL}/questions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        question: 'Which Article of the Indian Constitution abolishes untouchability?',
        options: ['Article 14', 'Article 15', 'Article 17', 'Article 19'],
        correctAnswer: 2,
        explanation: 'Article 17 explicitly abolishes untouchability and forbids its practice.',
        subject: 'Indian Polity',
        topic: 'Fundamental Rights',
        exam: 'SSC CGL',
        difficulty: 'Easy',
        sourceType: 'ADMIN_CREATED'
      })
    });
    const createQData = await createQRes.json();
    if (!createQData.success) throw new Error('Failed to create manual question: ' + JSON.stringify(createQData));
    const testQ = createQData.question;
    console.log(`✔ Manual question created successfully (ID: ${testQ._id}, Status: ${testQ.status}).`);

    // 4. Test Duplicate Detection
    console.log('\n4. Testing duplicate detection endpoint (/api/questions/duplicate-check)...');
    const dupCheckRes = await fetch(`${BASE_URL}/questions/duplicate-check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        question: 'Which Article of the Indian Constitution abolishes untouchability?'
      })
    });
    const dupCheckData = await dupCheckRes.json();
    if (!dupCheckData.success || !dupCheckData.isDuplicate) {
      throw new Error('Duplicate check failed: ' + JSON.stringify(dupCheckData));
    }
    console.log(`✔ Duplicate detection PASSED. Duplicate flag: ${dupCheckData.isDuplicate}, Matches: ${dupCheckData.matches.length}`);

    // 5. Test Question Editing & Audit Trail (Version History)
    console.log('\n5. Testing question edit & version audit trail (PUT /api/questions/:id)...');
    const editQRes = await fetch(`${BASE_URL}/questions/${testQ._id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        explanation: 'Article 17 explicitly abolishes untouchability in all forms and renders its enforcement punishable by law.',
        difficulty: 'Medium'
      })
    });
    const editQData = await editQRes.json();
    if (!editQData.success || editQData.question.versionHistory.length === 0) {
      throw new Error('Edit question audit trail failed: ' + JSON.stringify(editQData));
    }
    console.log(`✔ Question edit audit trail PASSED. Recorded version history items: ${editQData.question.versionHistory.length}`);

    // 6. Create a Pending Review question as Student
    console.log('\n6. Creating question as Student (should enter PENDING_REVIEW status)...');
    const studentQRes = await fetch(`${BASE_URL}/questions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`
      },
      body: JSON.stringify({
        question: 'What is the speed of light in vacuum?',
        options: ['3 x 10^8 m/s', '3 x 10^6 m/s', '3 x 10^10 m/s', '3 x 10^5 m/s'],
        correctAnswer: 0,
        explanation: 'Speed of light is approximately 300,000 km/s or 3x10^8 m/s.',
        subject: 'Physics',
        topic: 'Optics',
        difficulty: 'Easy'
      })
    });
    const studentQData = await studentQRes.json();
    if (!studentQData.success || studentQData.question.status !== 'PENDING_REVIEW') {
      throw new Error('Student question creation status check failed: ' + JSON.stringify(studentQData));
    }
    const pendingQId = studentQData.question._id;
    console.log(`✔ Student question created with PENDING_REVIEW status (ID: ${pendingQId}).`);

    // 7. Test Student RLS Security Filter
    console.log('\n7. Verifying Student RLS Security Filter (student cannot fetch PENDING_REVIEW questions)...');
    const studentFetchRes = await fetch(`${BASE_URL}/questions`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    const studentFetchData = await studentFetchRes.json();
    const containsPending = studentFetchData.questions.some(q => q._id === pendingQId || q.status !== 'PUBLISHED');
    if (containsPending) {
      throw new Error('SECURITY VIOLATION: Student received non-published questions!');
    }
    console.log(`✔ Student RLS security check PASSED. Student received ${studentFetchData.questions.length} questions, ALL are PUBLISHED.`);

    // 8. Admin approves student pending question
    console.log('\n8. Admin approving student pending question (PUT /api/admin/questions/:id/status)...');
    const approveRes = await fetch(`${BASE_URL}/admin/questions/${pendingQId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ status: 'PUBLISHED', verified: true })
    });
    const approveData = await approveRes.json();
    if (!approveData.success || approveData.question.status !== 'PUBLISHED') {
      throw new Error('Admin approval failed: ' + JSON.stringify(approveData));
    }
    console.log(`✔ Admin approval PASSED. Question status is now PUBLISHED.`);

    // 9. Test Bulk Question Import API
    console.log('\n9. Testing Bulk Question Import API (/api/import/bulk-questions)...');
    const bulkRes = await fetch(`${BASE_URL}/import/bulk-questions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        autoPublish: 'true',
        questions: [
          {
            question: 'Who was the first Governor-General of independent India?',
            options: ['Lord Mountbatten', 'C. Rajagopalachari', 'Dr. Rajendra Prasad', 'Jawaharlal Nehru'],
            correctAnswer: 0,
            explanation: 'Lord Mountbatten served as the first Governor-General of independent India.',
            subject: 'History',
            topic: 'Modern India',
            difficulty: 'Medium'
          },
          {
            question: 'What is the chemical symbol for Gold?',
            options: ['Ag', 'Au', 'Fe', 'Cu'],
            correctAnswer: 1,
            explanation: 'Au comes from the Latin word Aurum.',
            subject: 'Chemistry',
            topic: 'Elements',
            difficulty: 'Easy'
          }
        ]
      })
    });
    const bulkData = await bulkRes.json();
    if (!bulkData.success || bulkData.summary.valid !== 2) {
      throw new Error('Bulk import failed: ' + JSON.stringify(bulkData));
    }
    console.log(`✔ Bulk import PASSED. Imported: ${bulkData.summary.valid}, Summary:`, bulkData.summary);

    console.log('\n=== ALL PHASE 5 QUESTION BANK & ADMIN REVIEW TESTS PASSED 100% ===');
  } catch (err) {
    console.error('\n❌ PHASE 5 TEST FAILURE:', err.message);
    process.exit(1);
  }
}

runPhase5Tests();
