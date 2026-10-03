import fs from 'fs';
import path from 'path';
import { validatePastedText } from '../services/storageService.js';

export const runPhase4StorageTests = async () => {
  console.log('======================================================');
  console.log('  PHASE 4 — SUPABASE STORAGE & FILE PIPELINE AUDIT');
  console.log('======================================================');

  const testResults = [];

  // 1. Test Pasted Text Size Validation
  try {
    const validPasted = validatePastedText('This is a test transcript line for competitive exam study material.');
    testResults.push({ name: 'Pasted Text Validation (Valid input)', passed: validPasted.charCount > 0 });
  } catch (e) {
    testResults.push({ name: 'Pasted Text Validation (Valid input)', passed: false, error: e.message });
  }

  // 2. Test Oversized Pasted Text Error Handling
  try {
    const hugeText = 'A'.repeat(600000); // 600k chars > 500k limit
    validatePastedText(hugeText, 500000);
    testResults.push({ name: 'Oversized Pasted Text Guard (600k chars)', passed: false });
  } catch (e) {
    testResults.push({ name: 'Oversized Pasted Text Guard (600k chars)', passed: e.message.includes('exceeds maximum limit') });
  }

  // 3. Test Unauthorized Student Upload Rejection (API level test)
  try {
    const studentLogin = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'student@shakti.com', password: 'student123' })
    });
    const studentData = await studentLogin.json();

    const uploadRes = await fetch('http://localhost:5000/api/import/admin-upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentData.token}`
      },
      body: JSON.stringify({ pastedText: 'Sample text by student' })
    });

    testResults.push({
      name: 'Unauthorized Student Document Upload Guard',
      passed: uploadRes.status === 403,
      httpStatus: uploadRes.status
    });
  } catch (e) {
    testResults.push({ name: 'Unauthorized Student Document Upload Guard', passed: false, error: e.message });
  }

  // 4. Test Authorized Admin Document Upload (API level test)
  try {
    const adminLogin = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@shakti.com', password: 'admin123' })
    });
    const adminData = await adminLogin.json();

    const adminUploadRes = await fetch('http://localhost:5000/api/import/admin-upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminData.token}`
      },
      body: JSON.stringify({
        pastedText: 'Article 61 of the Indian Constitution provides for the impeachment procedure of the President.',
        subject: 'Indian Polity',
        topic: 'President'
      })
    });
    const adminUploadData = await adminUploadRes.json();

    testResults.push({
      name: 'Admin Document Processing & Review Queueing',
      passed: adminUploadData.success && adminUploadData.summary?.status === 'PENDING_ADMIN_REVIEW',
      mcqsQueued: adminUploadData.summary?.mcqsGenerated
    });
  } catch (e) {
    testResults.push({ name: 'Admin Document Processing & Review Queueing', passed: false, error: e.message });
  }

  return testResults;
};
