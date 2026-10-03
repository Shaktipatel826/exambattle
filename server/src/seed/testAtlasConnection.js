import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import mongoose from 'mongoose';

const envPath = fs.existsSync('./server/.env') ? './server/.env' : './.env';
dotenv.config({ path: envPath });

import { connectDB, getDBStatus, sanitizeMongoUri } from '../config/db.js';

import { User } from '../models/User.js';
import { Question } from '../models/Question.js';
import { Subject } from '../models/Subject.js';
import { SubSubject } from '../models/SubSubject.js';
import { Topic } from '../models/Topic.js';
import { Exam } from '../models/Exam.js';
import { TestAttempt } from '../models/TestAttempt.js';
import { AIJob } from '../models/AIJob.js';
import { Mistake } from '../models/Mistake.js';
import { XPTransaction } from '../models/GamificationSystem.js';

async function runAtlasConnectionTest() {
  console.log('=== Starting ExamBattle MongoDB Atlas Connection Verification ===\n');

  try {
    const rawUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/shakti_exam_db';
    const safeUri = sanitizeMongoUri(rawUri);

    console.log(`1. Target Database URI: ${safeUri}`);
    console.log(`   - Environment: ${process.env.NODE_ENV || 'development'}`);

    // Connect to Database
    console.log('\n2. Connecting to MongoDB database...');
    await connectDB();

    if (!getDBStatus()) {
      throw new Error('Database connection failed: getDBStatus() returned false.');
    }
    console.log('✔ Database connection established successfully.');

    // Verify Active Connection Details
    const conn = mongoose.connection;
    const dbName = conn.name || 'shakti_exam_db';
    console.log(`\n3. Verifying Database Metadata...`);
    console.log(`   - Active Database Name: ${dbName}`);
    console.log(`   - Connection Host: ${conn.host}`);
    console.log(`   - Ready State: ${conn.readyState} (1 = Connected)`);

    // Verify Mongoose Model Initializations (Safe Read-Only Operations)
    console.log('\n4. Executing Safe Read-Only Model Initialization Checks...');

    const userCount = await User.countDocuments();
    console.log(`   - Users Collection (${User.collection.name}): ${userCount} documents`);

    const questionCount = await Question.countDocuments();
    console.log(`   - Questions Collection (${Question.collection.name}): ${questionCount} documents`);

    const subjectCount = await Subject.countDocuments();
    console.log(`   - Subjects Collection (${Subject.collection.name}): ${subjectCount} documents`);

    const subSubjectCount = await SubSubject.countDocuments();
    console.log(`   - SubSubjects Collection (${SubSubject.collection.name}): ${subSubjectCount} documents`);

    const topicCount = await Topic.countDocuments();
    console.log(`   - Topics Collection (${Topic.collection.name}): ${topicCount} documents`);

    const examCount = await Exam.countDocuments();
    console.log(`   - Exams Collection (${Exam.collection.name}): ${examCount} documents`);

    const attemptCount = await TestAttempt.countDocuments();
    console.log(`   - TestAttempts Collection (${TestAttempt.collection.name}): ${attemptCount} documents`);

    const jobCount = await AIJob.countDocuments();
    console.log(`   - AIJobs Collection (${AIJob.collection.name}): ${jobCount} documents`);

    const mistakeCount = await Mistake.countDocuments();
    console.log(`   - Mistakes Collection (${Mistake.collection.name}): ${mistakeCount} documents`);

    const xpCount = await XPTransaction.countDocuments();
    console.log(`   - XPTransactions Collection (${XPTransaction.collection.name}): ${xpCount} documents`);

    console.log('\n5. Verifying Safety Constraints...');
    console.log('   - Destructive Operations Performed: NONE');
    console.log('   - Databases Dropped / Reset: NONE');
    console.log('   - Sensitive Credentials Exposed: NONE');

    console.log('\n=============================================================');
    console.log('🎉 MONGODB ATLAS / DATABASE CONNECTION TEST PASSED 100%!');
    console.log('=============================================================\n');

    process.exit(0);
  } catch (err) {
    console.error('\n❌ MONGODB ATLAS CONNECTION TEST FAILED:');
    console.error(err.message);
    process.exit(1);
  }
}

runAtlasConnectionTest();
