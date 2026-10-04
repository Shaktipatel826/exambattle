import { executeGeminiPrompt } from './geminiProvider.js';
import { buildMcqPrompt } from './promptBuilder.js';
import { parseCleanJSON, validateMCQSchema } from './contentParser.js';
import { Question } from '../../models/Question.js';
import { AIJob } from '../../models/AIJob.js';

/**
 * Split text into logical chunks on paragraph/heading/timestamp boundaries without cutting sentences
 */
export const splitTextIntoLogicalChunks = (text, targetChunkChars = 4000) => {
  if (!text || typeof text !== 'string') return [];
  const clean = text.trim();
  if (clean.length <= targetChunkChars) return [clean];

  // Split by double line breaks (paragraphs/sections)
  const paragraphs = clean.split(/\n\s*\n/);
  const chunks = [];
  let currentChunk = '';

  for (const para of paragraphs) {
    if ((currentChunk.length + para.length) <= targetChunkChars) {
      currentChunk += (currentChunk ? '\n\n' : '') + para;
    } else {
      if (currentChunk) chunks.push(currentChunk.trim());
      currentChunk = para;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks.length > 0 ? chunks : [clean.substring(0, targetChunkChars)];
};

/**
 * Helper to normalize question statements for strict duplicate detection
 */
const normalizeQuestionText = (text = '') => {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Helper to escape regex special characters
 */
const escapeRegex = (string = '') => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Process AI Job: Extract MAXIMUM source-grounded MCQs across ALL chunks without artificial caps.
 * Strictly NO Study Notes, NO One-Liners, NO Summaries, NO Flashcards for Admin AI Question Generator.
 */
export const processAIContentJob = async ({
  jobId,
  extractedText,
  subject = 'General Studies',
  topic = 'General',
  exam = 'General',
  difficulty = 'Medium',
  createdBy = 'Admin'
}) => {
  const job = await AIJob.findOne({ jobId });
  if (!job) throw new Error(`AI Job ${jobId} not found.`);

  try {
    job.status = 'PROCESSING';
    job.totalChars = extractedText.length;
    
    // Split complete document into 4000-char logical chunks
    const chunks = splitTextIntoLogicalChunks(extractedText, 4000);
    job.totalChunks = chunks.length;
    await job.save();

    console.log(`[AI-GEN] Source characters: ${extractedText.length}`);
    console.log(`[AI-GEN] Total chunks: ${chunks.length}`);

    let rawExtractedCount = 0;
    let duplicateCount = 0;
    let invalidCount = 0;
    let completedChunks = 0;
    let failedChunks = 0;

    const accumulatedMcqs = [];
    const seenInBatch = new Set();

    // Process ALL chunks (Chunk 1 to Chunk N) without stopping
    for (let i = 0; i < chunks.length; i++) {
      const chunkText = chunks[i];
      console.log(`[AI-GEN] Processing chunk ${i + 1}/${chunks.length} (${chunkText.length} chars)...`);

      try {
        // Prompt Gemini to extract maximum source-grounded MCQs from this chunk
        const prompt = buildMcqPrompt(chunkText, subject, topic, exam, difficulty);
        const rawOutput = await executeGeminiPrompt(prompt);
        const parsed = parseCleanJSON(rawOutput);

        if (parsed && Array.isArray(parsed.mcqs)) {
          const chunkMcqCount = parsed.mcqs.length;
          rawExtractedCount += chunkMcqCount;
          console.log(`[AI-GEN] Chunk ${i + 1} MCQs extracted: ${chunkMcqCount}`);

          for (const rawQ of parsed.mcqs) {
            const valQ = validateMCQSchema(rawQ, subject, topic);
            if (!valQ) {
              invalidCount++;
              continue;
            }

            const normKey = normalizeQuestionText(valQ.question);
            
            // Check internal duplicate within current job batch
            if (seenInBatch.has(normKey)) {
              duplicateCount++;
              console.log(`[AI-GEN] Batch Duplicate skipped: "${valQ.question.substring(0, 50)}..."`);
              continue;
            }
            seenInBatch.add(normKey);

            // Check duplicate in MongoDB Question Bank
            const existingInDb = await Question.findOne({
              question: { $regex: new RegExp(`^${escapeRegex(valQ.question.trim())}$`, 'i') }
            });

            valQ.duplicateFlag = !!existingInDb;
            valQ.sourceReference = `Chunk ${i + 1} (${valQ.sourceReference || 'Source Material'})`;

            accumulatedMcqs.push(valQ);
          }
        } else {
          console.warn(`[AI-GEN] Chunk ${i + 1} did not return valid MCQs array.`);
          invalidCount++;
        }
      } catch (chunkErr) {
        failedChunks++;
        console.warn(`[AI-GEN] Chunk ${i + 1} failed: ${chunkErr.message}. Continuing with remaining chunks.`);
      }

      completedChunks++;
      job.completedChunks = completedChunks;
      await job.save();
    }

    // Save ALL valid unique generated MCQs into MongoDB Question Collection
    const savedPendingMCQs = [];

    for (const q of accumulatedMcqs) {
      if (q.duplicateFlag) {
        duplicateCount++;
        console.log(`[AI-GEN] MongoDB Duplicate flagged: "${q.question.substring(0, 50)}..."`);
        // If question already exists in MongoDB, mark duplicateFlag true
      }

      const newQ = await Question.create({
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation || '',
        subject: q.subject || subject,
        topic: q.topic || topic,
        exam: exam || 'General',
        difficulty: q.difficulty || difficulty,
        source: job.sourceDocumentName || 'Source Document',
        sourceType: 'AI_GENERATED',
        sourceReference: q.sourceReference || 'AI Generator',
        tags: q.tags || [subject.toLowerCase(), topic.toLowerCase()],
        duplicateFlag: q.duplicateFlag || false,
        verified: false,
        status: 'PENDING_REVIEW', // Default: Queued for Admin Review
        createdBy: createdBy || 'Admin AI Generator'
      });

      savedPendingMCQs.push({
        questionId: newQ._id.toString(),
        question: newQ.question,
        options: newQ.options,
        correctAnswer: newQ.correctAnswer,
        explanation: newQ.explanation,
        subject: newQ.subject,
        topic: newQ.topic,
        difficulty: newQ.difficulty,
        sourceReference: newQ.sourceReference,
        duplicateFlag: newQ.duplicateFlag,
        status: newQ.status
      });
    }

    // Save complete Job summary in DB
    job.status = 'COMPLETED';
    job.oneLiners = [];
    job.studyNotes = null;
    job.generatedMcqs = savedPendingMCQs;
    job.generatedOneLinersCount = 0;
    job.generatedNotesCount = 0;
    job.generatedMcqCount = savedPendingMCQs.length;
    job.duplicateCount = duplicateCount;
    job.pendingReviewCount = savedPendingMCQs.length;
    await job.save();

    console.log(`[AI-GEN] Raw MCQs: ${rawExtractedCount}`);
    console.log(`[AI-GEN] Duplicates removed/flagged: ${duplicateCount}`);
    console.log(`[AI-GEN] Final unique MCQs saved to MongoDB: ${savedPendingMCQs.length}`);
    console.log(`[AI Job ${jobId}] SUCCESS: Generated & Saved ${savedPendingMCQs.length} MCQs across ${completedChunks} chunks.`);
    return job;
  } catch (err) {
    job.status = 'FAILED';
    job.errorDetails = err.message;
    await job.save();
    throw err;
  }
};
