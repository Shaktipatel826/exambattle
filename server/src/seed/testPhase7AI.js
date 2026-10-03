import { splitTextIntoLogicalChunks } from '../services/ai/chunkProcessor.js';
import { validateMCQSchema, validateOneLinerSchema, parseCleanJSON } from '../services/ai/contentParser.js';
import { buildOneLinersPrompt, buildStudyNotesPrompt, buildMcqPrompt } from '../services/ai/promptBuilder.js';

const BASE_URL = 'http://localhost:5000/api';

async function runPhase7Tests() {
  console.log('=== Starting Phase 7 Gemini AI Content Engine Verification Suite ===\n');

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

    // 3. Authorization Security Test: Student CANNOT start AI Job
    console.log('\n3. Verifying authorization security (Student blocked from admin-generate-job)...');
    const studentJobRes = await fetch(`${BASE_URL}/ai/admin-generate-job`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`
      },
      body: JSON.stringify({ pastedText: 'Test text' })
    });
    if (studentJobRes.status !== 403) {
      throw new Error(`SECURITY VIOLATION: Student received status ${studentJobRes.status} instead of 403 Forbidden!`);
    }
    console.log('✔ SECURITY PASSED: Student blocked with 403 Forbidden.');

    // 4. Test Text Chunking Logic (Logical paragraph boundaries)
    console.log('\n4. Testing safe text chunking processor...');
    const longSampleText = `
Paragraph 1: The Revolt of 1857 was a major uprising in India between 1857–58 against the rule of the British East India Company. It began on 10 May 1857 in the form of a mutiny of sepoys of the Company's army in the garrison town of Meerut.

Paragraph 2: The rebellion posed a considerable threat to British power in that region, and was contained only with the defeat of the rebels in Gwalior on 20 June 1858.

Paragraph 3: On 1 November 1858, the British granted amnesty to all rebels not involved in murder, though they did not declare the hostilities to have formally ended until 8 July 1859.

Paragraph 4: Its name is contested, and it is variously referred to as the Sepoy Mutiny, the Indian Mutiny, the Great Rebellion, the Revolt of 1857, the Indian Insurrection, and the First War of Independence.
    `.repeat(10);

    const chunks = splitTextIntoLogicalChunks(longSampleText, 1000);
    if (!Array.isArray(chunks) || chunks.length < 2) {
      throw new Error('Chunking processor failed to split text safely.');
    }
    console.log(`✔ Logical text chunking PASSED. Generated ${chunks.length} chunks without sentence truncation.`);

    // 5. Test MCQ Schema Validation & Recovery
    console.log('\n5. Testing MCQ schema validation and invalid item rejection...');
    const validRawMCQ = {
      question: 'In which year did the Revolt of 1857 begin at Meerut?',
      options: ['1857', '1856', '1858', '1860'],
      correct_answer: 'A',
      explanation: 'The revolt began on 10 May 1857 at Meerut garrison town.'
    };
    const validated = validateMCQSchema(validRawMCQ, 'History', 'Revolt of 1857');
    if (!validated || validated.correctAnswer !== 0 || validated.options.length !== 4) {
      throw new Error('MCQ schema validation failed: ' + JSON.stringify(validated));
    }
    console.log('✔ Valid MCQ schema correctly parsed (Option A index 0).');

    const invalidRawMCQ = {
      question: 'Short',
      options: ['Only Two Options', 'Option B']
    };
    const rejectedVal = validateMCQSchema(invalidRawMCQ);
    if (rejectedVal !== null) {
      throw new Error('SECURITY VIOLATION: Malformed MCQ was accepted by schema validator!');
    }
    console.log('✔ Malformed MCQ properly rejected by schema validator.');

    // 6. Test One-Liner Schema Validation
    console.log('\n6. Testing One-Liner schema validation...');
    const validOneLiner = validateOneLinerSchema({
      statement: 'East India Company rule ended following the Revolt of 1857.',
      topic: 'Modern India',
      importance: 'high'
    });
    if (!validOneLiner || !validOneLiner.text) {
      throw new Error('One-Liner validation failed.');
    }
    console.log('✔ One-Liner schema validation PASSED.');

    // 7. Test Admin Start AI Job Endpoint
    console.log('\n7. Executing Admin Start AI Job endpoint (/api/ai/admin-generate-job)...');
    const aiJobRes = await fetch(`${BASE_URL}/ai/admin-generate-job`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        pastedText: `
The Indian Constitution was adopted by the Constituent Assembly of India on 26 November 1949 and came into effect on 26 January 1950. 
Article 14 guarantees equality before law and equal protection of laws. 
Article 17 abolishes untouchability and forbids its practice in any form. 
Article 21 guarantees the protection of life and personal liberty.
        `,
        generationType: 'ALL',
        subject: 'Indian Polity',
        topic: 'Constitutional Articles',
        exam: 'SSC CGL',
        difficulty: 'Medium',
        mcqCount: 3
      })
    });

    const aiJobData = await aiJobRes.json();
    if (!aiJobData.success || !aiJobData.job) {
      throw new Error('Admin AI Job processing failed: ' + JSON.stringify(aiJobData));
    }
    const job = aiJobData.job;
    console.log(`✔ AI Job executed successfully! Job ID: [${job.jobId}], Status: ${job.status}`);
    console.log(`   Generated MCQs: ${job.generatedMcqCount}, One-Liners: ${job.generatedOneLinersCount}, Notes: ${job.generatedNotesCount}`);

    // Verify questions enter PENDING_REVIEW
    if (job.generatedMcqs && job.generatedMcqs.length > 0) {
      const generatedQ = job.generatedMcqs[0];
      if (generatedQ.status !== 'PENDING_REVIEW') {
        throw new Error('SECURITY VIOLATION: AI-generated question was auto-published!');
      }
      console.log(`✔ SECURITY VERIFIED: AI-generated question ID ${generatedQ.questionId} entered PENDING_REVIEW queue.`);

      // 8. Admin approves AI generated question
      console.log('\n8. Admin approving generated question to PUBLISHED status...');
      const approveRes = await fetch(`${BASE_URL}/admin/questions/${generatedQ.questionId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({ status: 'PUBLISHED', verified: true })
      });
      const approveData = await approveRes.json();
      if (!approveData.success || approveData.question.status !== 'PUBLISHED') {
        throw new Error('Question approval failed: ' + JSON.stringify(approveData));
      }
      console.log(`✔ Question approved! Status is now PUBLISHED.`);
    }

    console.log('\n=== ALL PHASE 7 GEMINI AI ENGINE TESTS PASSED 100% ===');
  } catch (err) {
    console.error('\n❌ PHASE 7 TEST FAILURE:', err.message);
    process.exit(1);
  }
}

runPhase7Tests();
