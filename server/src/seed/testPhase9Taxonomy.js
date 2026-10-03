const BASE_URL = 'http://localhost:5000/api';

async function runPhase9Tests() {
  console.log('=== Starting Phase 9 Admin Content Management & Taxonomy Verification Suite ===\n');

  try {
    // 1. Log in Admin
    console.log('1. Logging in Admin (admin@shakti.com)...');
    const adminLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@shakti.com', password: 'admin123', role: 'ADMIN' })
    });
    const adminLogin = await adminLoginRes.json();
    if (!adminLogin.token) throw new Error('Admin login failed: ' + JSON.stringify(adminLogin));
    const adminToken = adminLogin.token;
    console.log('✔ Admin login successful.');

    // 2. Log in Student
    console.log('\n2. Logging in Student (student@shakti.com)...');
    const studentLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'student@shakti.com', password: 'student123', role: 'STUDENT' })
    });
    const studentLogin = await studentLoginRes.json();
    if (!studentLogin.token) throw new Error('Student login failed: ' + JSON.stringify(studentLogin));
    const studentToken = studentLogin.token;
    console.log('✔ Student login successful.');

    // 3. Security Test: Student CANNOT create a subject
    console.log('\n3. Verifying authorization security (Student blocked from creating taxonomy)...');
    const studentCreateRes = await fetch(`${BASE_URL}/admin/subjects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`
      },
      body: JSON.stringify({ name: 'Hacking Subject' })
    });
    if (studentCreateRes.status !== 403) {
      throw new Error(`SECURITY VIOLATION: Student received status ${studentCreateRes.status} instead of 403 Forbidden!`);
    }
    console.log('✔ SECURITY PASSED: Student blocked with 403 Forbidden.');

    // 4. Admin Creates a Subject
    const testSubjectName = `Environmental Science & Ecology_${Date.now()}`;
    console.log(`\n4. Admin creating Subject "${testSubjectName}"...`);
    const createSubRes = await fetch(`${BASE_URL}/admin/subjects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        name: testSubjectName,
        code: 'ENV_SCI',
        description: 'Ecology, Biodiversity & Climate Change'
      })
    });
    const createSubData = await createSubRes.json();
    if (!createSubData.success || !createSubData.subject) {
      throw new Error('Failed to create subject: ' + JSON.stringify(createSubData));
    }
    const createdSubject = createSubData.subject;
    console.log(`✔ Subject created successfully! ID: ${createdSubject._id}`);

    // 5. Duplicate Protection Test
    console.log('\n5. Verifying Duplicate Subject Protection...');
    const dupSubRes = await fetch(`${BASE_URL}/admin/subjects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ name: testSubjectName })
    });
    const dupSubData = await dupSubRes.json();
    if (dupSubRes.status !== 400 || dupSubData.success !== false) {
      throw new Error('Duplicate protection failed! System allowed duplicate subject creation.');
    }
    console.log(`✔ Duplicate protection PASSED: Received 400 Bad Request ("${dupSubData.message}").`);

    // 6. Admin Edits Subject
    console.log('\n6. Admin editing Subject details...');
    const editSubRes = await fetch(`${BASE_URL}/admin/subjects/${createdSubject._id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        description: 'Updated Ecology & Biodiversity Studies'
      })
    });
    const editSubData = await editSubRes.json();
    if (!editSubData.success || editSubData.subject.description !== 'Updated Ecology & Biodiversity Studies') {
      throw new Error('Subject edit failed: ' + JSON.stringify(editSubData));
    }
    console.log('✔ Subject edit PASSED.');

    // 7. Admin Creates SubSubject
    console.log('\n7. Admin creating SubSubject...');
    const createSubSubRes = await fetch(`${BASE_URL}/admin/sub-subjects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        subjectId: createdSubject._id,
        name: 'Climate Change & Global Warming'
      })
    });
    const createSubSubData = await createSubSubRes.json();
    if (!createSubSubData.success) {
      throw new Error('SubSubject creation failed: ' + JSON.stringify(createSubSubData));
    }
    const createdSubSubject = createSubSubData.subSubject;
    console.log(`✔ SubSubject created successfully! ID: ${createdSubSubject._id}`);

    // 8. Admin Creates Topic
    console.log('\n8. Admin creating Topic...');
    const createTopicRes = await fetch(`${BASE_URL}/admin/topics`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        subjectId: createdSubject._id,
        subSubjectId: createdSubSubject._id,
        name: 'Paris Agreement & COP Summit Protocols'
      })
    });
    const createTopicData = await createTopicRes.json();
    if (!createTopicData.success) {
      throw new Error('Topic creation failed: ' + JSON.stringify(createTopicData));
    }
    console.log(`✔ Topic created successfully! ID: ${createTopicData.topic._id}`);

    // 9. Admin Creates Exam
    const testExamName = `ISRO Scientist Exam_${Date.now()}`;
    console.log(`\n9. Admin creating Exam "${testExamName}"...`);
    const createExamRes = await fetch(`${BASE_URL}/admin/exams`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        name: testExamName,
        shortName: 'ISRO Sci',
        category: 'Other',
        organization: 'Indian Space Research Organisation'
      })
    });
    const createExamData = await createExamRes.json();
    if (!createExamData.success) {
      throw new Error('Exam creation failed: ' + JSON.stringify(createExamData));
    }
    console.log(`✔ Exam created successfully! ID: ${createExamData.exam._id}`);

    // 10. Admin Deactivates Subject (Soft Delete)
    console.log('\n10. Admin deactivating Subject (Soft Delete)...');
    const deleteSubRes = await fetch(`${BASE_URL}/admin/subjects/${createdSubject._id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const deleteSubData = await deleteSubRes.json();
    if (!deleteSubData.success || deleteSubData.subject.active !== false) {
      throw new Error('Subject deactivation failed: ' + JSON.stringify(deleteSubData));
    }
    console.log('✔ Subject soft-deactivated successfully (active set to false).');

    // 11. Managed Taxonomy Endpoint
    console.log('\n11. Fetching Dynamic Managed Taxonomy (`GET /api/taxonomy/managed`)...');
    const managedRes = await fetch(`${BASE_URL}/taxonomy/managed`);
    const managedData = await managedRes.json();
    if (!managedData.success || !Array.isArray(managedData.subjects) || !Array.isArray(managedData.exams)) {
      throw new Error('Managed taxonomy endpoint failed: ' + JSON.stringify(managedData));
    }
    console.log(`✔ Dynamic Taxonomy retrieved: ${managedData.subjects.length} active subjects, ${managedData.exams.length} active exams.`);

    console.log('\n=============================================================');
    console.log('🎉 ALL PHASE 9 CONTENT MANAGEMENT & TAXONOMY TESTS PASSED!');
    console.log('=============================================================\n');

  } catch (error) {
    console.error('\n❌ PHASE 9 VERIFICATION FAILED:');
    console.error(error);
    process.exit(1);
  }
}

runPhase9Tests();
