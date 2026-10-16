/**
 * ExamBattle Question Bank Verification Script
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: 'server/.env' });

const schema = new mongoose.Schema({}, { strict: false });
const Q = mongoose.models.Question || mongoose.model('Question', schema);

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected to MongoDB\n');

  const total = await Q.countDocuments({ status: 'PUBLISHED' });
  console.log(`📊 Total PUBLISHED Questions: ${total}\n`);

  const bySubject = await Q.aggregate([
    { $match: { status: 'PUBLISHED' } },
    { $group: { _id: '$subject', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);
  console.log('📚 By Subject:');
  bySubject.forEach(s => console.log(`   ${(s._id || 'Unknown').padEnd(32)} ${s.count}`));

  const byDiff = await Q.aggregate([
    { $match: { status: 'PUBLISHED' } },
    { $group: { _id: '$difficulty', count: { $sum: 1 } } }
  ]);
  console.log('\n🎯 By Difficulty:', byDiff.map(d => `${d._id}:${d.count}`).join(', '));

  // Test random sample 
  const sample10 = await Q.aggregate([
    { $match: { status: 'PUBLISHED' } },
    { $sample: { size: 10 } }
  ]);
  console.log('\n🎲 Random Sample (10 questions):');
  sample10.forEach((q, i) => console.log(`   ${i + 1}. [${q.subject}] ${q.question.substring(0, 60)}...`));

  // Test subject-specific sample
  const polityQ = await Q.aggregate([
    { $match: { status: 'PUBLISHED', subject: 'Indian Polity' } },
    { $sample: { size: 5 } }
  ]);
  console.log(`\n✅ Indian Polity sample (5): ${polityQ.length} returned`);

  // Test distinct subjects (what students see in filters)
  const subjects = await Q.distinct('subject', { status: 'PUBLISHED' });
  console.log(`\n📋 Available subjects for practice: ${subjects.join(', ')}`);

  await mongoose.disconnect();
  console.log('\n✅ Verification complete!');
  process.exit(0);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
