/**
 * ExamBattle Question Bank Seeder
 * ================================
 * Idempotent: Safe to run multiple times.
 * Reads JSON files from ./data/ and inserts into MongoDB.
 * Skips exact duplicates (by normalized question text).
 * Reports inserted, skipped, invalid, and total counts per subject.
 *
 * Usage:
 *   node server/src/seed/seedQuestionBank.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config({ path: 'server/.env' });

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Inline Question Schema (avoids import issues when run standalone) ───────
const questionSchema = new mongoose.Schema({
  question:      { type: String, required: true },
  options:       [{ type: String, required: true }],
  correctAnswer: { type: Number, required: true },
  explanation:   { type: String, default: '' },
  subject:       { type: String, required: true, index: true },
  subSubject:    { type: String, default: '' },
  topic:         { type: String, required: true, index: true },
  exam:          { type: String, default: 'General', index: true },
  examYear:      { type: Number },
  difficulty:    { type: String, enum: ['Easy', 'Medium', 'Hard'], default: 'Medium' },
  language:      { type: String, default: 'en' },
  source:        { type: String, default: 'Question Bank' },
  sourceType:    { type: String, default: 'ADMIN_CREATED' },
  tags:          [{ type: String }],
  verified:      { type: Boolean, default: true },
  status:        { type: String, default: 'PUBLISHED' },
  createdBy:     { type: String, default: 'System Seed' },
  duplicateFlag: { type: Boolean, default: false },
  versionHistory:{ type: Array, default: [] }
}, { timestamps: true });

questionSchema.index({ subject: 1, topic: 1, exam: 1, status: 1 });

const Question = mongoose.models.Question || mongoose.model('Question', questionSchema);

// ─── Normalize question text for duplicate detection ─────────────────────────
function normalize(text) {
  if (!text) return '';
  return text.toLowerCase().replace(/[^a-z0-9\u0900-\u097f]/g, '').trim();
}

// ─── Validate a single question object ───────────────────────────────────────
function validate(q, index) {
  const errors = [];
  if (!q.question || typeof q.question !== 'string' || q.question.trim().length < 10)
    errors.push(`[${index}] question text missing or too short`);
  if (!Array.isArray(q.options) || q.options.length !== 4)
    errors.push(`[${index}] must have exactly 4 options`);
  if (typeof q.correctAnswer !== 'number' || q.correctAnswer < 0 || q.correctAnswer > 3)
    errors.push(`[${index}] correctAnswer must be 0-3`);
  if (!q.subject || typeof q.subject !== 'string')
    errors.push(`[${index}] subject missing`);
  if (!q.topic || typeof q.topic !== 'string')
    errors.push(`[${index}] topic missing`);
  if (!['Easy', 'Medium', 'Hard'].includes(q.difficulty))
    errors.push(`[${index}] invalid difficulty: ${q.difficulty}`);
  return errors;
}

// ─── Seed one JSON file ───────────────────────────────────────────────────────
async function seedFile(filePath, existingNorms) {
  const fileName = path.basename(filePath);
  console.log(`\n📂 Processing: ${fileName}`);

  let rawData;
  try {
    rawData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (e) {
    console.error(`  ❌ JSON parse error in ${fileName}: ${e.message}`);
    return { inserted: 0, skipped: 0, invalid: 0, total: 0 };
  }

  if (!Array.isArray(rawData)) {
    console.error(`  ❌ ${fileName} does not contain a JSON array`);
    return { inserted: 0, skipped: 0, invalid: 0, total: 0 };
  }

  let inserted = 0, skipped = 0, invalid = 0;
  const batch = [];

  for (let i = 0; i < rawData.length; i++) {
    const q = rawData[i];

    // Validate
    const errors = validate(q, i + 1);
    if (errors.length > 0) {
      console.warn(`  ⚠️  Invalid Q#${i + 1}: ${errors.join('; ')}`);
      invalid++;
      continue;
    }

    // Duplicate check
    const norm = normalize(q.question);
    if (existingNorms.has(norm)) {
      skipped++;
      continue;
    }
    existingNorms.add(norm);

    // Prepare document
    batch.push({
      question:      q.question.trim(),
      options:       q.options.map(o => String(o).trim()),
      correctAnswer: Number(q.correctAnswer),
      explanation:   q.explanation ? q.explanation.trim() : '',
      subject:       q.subject.trim(),
      subSubject:    q.subSubject || '',
      topic:         q.topic.trim(),
      exam:          q.exam || 'General',
      examYear:      q.examYear || null,
      difficulty:    q.difficulty || 'Medium',
      language:      q.language || 'en',
      source:        q.source || 'ExamBattle Question Bank',
      sourceType:    q.sourceType || 'ADMIN_CREATED',
      tags:          Array.isArray(q.tags) ? q.tags : [],
      verified:      q.verified !== undefined ? q.verified : true,
      status:        'PUBLISHED',
      createdBy:     'System Seed',
      duplicateFlag: false,
      versionHistory: []
    });
  }

  // Bulk insert in batches of 50
  const BATCH_SIZE = 50;
  for (let i = 0; i < batch.length; i += BATCH_SIZE) {
    const chunk = batch.slice(i, i + BATCH_SIZE);
    try {
      await Question.insertMany(chunk, { ordered: false });
      inserted += chunk.length;
    } catch (e) {
      // Handle partial inserts (duplicate key errors from concurrent inserts)
      if (e.insertedDocs) inserted += e.insertedDocs.length;
      console.warn(`  ⚠️  Batch insert warning: ${e.message.substring(0, 100)}`);
    }
  }

  const total = rawData.length;
  console.log(`  ✅ ${fileName}: ${total} total | ${inserted} inserted | ${skipped} skipped (dup) | ${invalid} invalid`);
  return { inserted, skipped, invalid, total };
}

// ─── Main Seeder ─────────────────────────────────────────────────────────────
async function main() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║   ExamBattle Question Bank Seeder v1.0                 ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI not set in server/.env');
    process.exit(1);
  }

  console.log('🔌 Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected to MongoDB\n');

  // Load existing question texts for duplicate detection
  console.log('🔍 Loading existing question fingerprints...');
  const allExisting = await Question.find({}, { question: 1 }).lean();
  const existingNorms = new Set(allExisting.map(q => normalize(q.question)));
  console.log(`   Found ${allExisting.length} existing questions in database.\n`);

  // Scan data directory
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) {
    console.error(`❌ Data directory not found: ${dataDir}`);
    console.error('   Run the question writer subagents first to generate JSON files.');
    process.exit(1);
  }

  const jsonFiles = fs.readdirSync(dataDir)
    .filter(f => f.endsWith('.json'))
    .map(f => path.join(dataDir, f));

  if (jsonFiles.length === 0) {
    console.error('❌ No JSON files found in data/ directory');
    process.exit(1);
  }

  console.log(`📋 Found ${jsonFiles.length} question data file(s):`);
  jsonFiles.forEach(f => console.log(`   • ${path.basename(f)}`));

  // Process each file
  const totals = { inserted: 0, skipped: 0, invalid: 0, total: 0 };
  const subjectReport = [];

  for (const file of jsonFiles) {
    const result = await seedFile(file, existingNorms);
    totals.inserted += result.inserted;
    totals.skipped  += result.skipped;
    totals.invalid  += result.invalid;
    totals.total    += result.total;
    subjectReport.push({ file: path.basename(file), ...result });
  }

  // Final count from DB
  const finalCount = await Question.countDocuments({ status: 'PUBLISHED' });
  const bySubject  = await Question.aggregate([
    { $match: { status: 'PUBLISHED' } },
    { $group: { _id: '$subject', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);

  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║   SEED COMPLETE — Final Report                         ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log(`\n📊 Session Summary:`);
  console.log(`   Total processed : ${totals.total}`);
  console.log(`   Inserted (new)  : ${totals.inserted}`);
  console.log(`   Skipped (dup)   : ${totals.skipped}`);
  console.log(`   Invalid         : ${totals.invalid}`);
  console.log(`\n📚 PUBLISHED Questions in MongoDB by Subject:`);
  bySubject.forEach(s => {
    const bar = '█'.repeat(Math.min(Math.round(s.count / 5), 20));
    console.log(`   ${(s._id || 'Unknown').padEnd(28)} ${String(s.count).padStart(4)} ${bar}`);
  });
  console.log(`\n   ── TOTAL PUBLISHED QUESTIONS: ${finalCount} ──`);
  console.log('\n✅ Question Bank seeding complete!\n');

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(e => {
  console.error('❌ Seeder failed:', e);
  process.exit(1);
});
