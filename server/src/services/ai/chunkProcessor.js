import { executeGeminiPrompt } from './geminiProvider.js';
import { buildOneLinersPrompt, buildStudyNotesPrompt, buildMcqPrompt } from './promptBuilder.js';
import { parseCleanJSON, validateMCQSchema, validateOneLinerSchema } from './contentParser.js';
import { Question } from '../../models/Question.js';
import { AIJob } from '../../models/AIJob.js';

/**
 * Split text into logical chunks on paragraph/heading/timestamp boundaries without cutting sentences
 */
export const splitTextIntoLogicalChunks = (text, targetChunkChars = 3500) => {
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
 * Process AI Job sequentially/in safe batches with metadata updates and duplicate checking
 */
export const processAIContentJob = async ({
  jobId,
  extractedText,
  generationType = 'ALL',
  subject = 'General Studies',
  topic = 'General',
  exam = 'General',
  difficulty = 'Medium',
  mcqCount = 5,
  createdBy = 'Admin'
}) => {
  const job = await AIJob.findOne({ jobId });
  if (!job) throw new Error(`AI Job ${jobId} not found.`);

  try {
    job.status = 'PROCESSING';
    job.totalChars = extractedText.length;
    
    const chunks = splitTextIntoLogicalChunks(extractedText, 3500);
    job.totalChunks = chunks.length;
    await job.save();

    let accumulatedOneLiners = [];
    let accumulatedStudyNotes = null;
    let accumulatedMcqs = [];
    let completedChunks = 0;
    let failedChunks = 0;

    for (let i = 0; i < chunks.length; i++) {
      const chunkText = chunks[i];

      // 1. One-Liners
      if (generationType === 'ONE_LINERS' || generationType === 'ALL') {
        try {
          const prompt = buildOneLinersPrompt(chunkText, subject, topic);
          const rawOutput = await executeGeminiPrompt(prompt);
          const parsed = parseCleanJSON(rawOutput);
          if (parsed && Array.isArray(parsed.oneLiners)) {
            parsed.oneLiners.forEach(item => {
              const val = validateOneLinerSchema(item, topic);
              if (val) accumulatedOneLiners.push(val);
            });
          }
        } catch (err) {
          console.warn(`[AI Job ${jobId}] Chunk ${i + 1} Gemini One-Liners fallback: ${err.message}`);
          const fallbackLines = chunkText.split(/\r?\n/).filter(line => line.trim().length > 15).slice(0, 4);
          fallbackLines.forEach(line => {
            const val = validateOneLinerSchema({ text: line.trim(), topic, importance: 'high' }, topic);
            if (val) accumulatedOneLiners.push(val);
          });
        }
      }

      // 2. Study Notes
      if (generationType === 'STUDY_NOTES' || generationType === 'ALL') {
        try {
          const prompt = buildStudyNotesPrompt(chunkText, subject, topic);
          const rawOutput = await executeGeminiPrompt(prompt);
          const parsed = parseCleanJSON(rawOutput);
          if (parsed && parsed.studyNotes) {
            accumulatedStudyNotes = parsed.studyNotes;
          }
        } catch (err) {
          console.warn(`[AI Job ${jobId}] Chunk ${i + 1} Gemini Study Notes fallback: ${err.message}`);
          accumulatedStudyNotes = {
            title: `${subject} - ${topic} Summary Notes`,
            overview: `Extracted study notes for ${topic} in ${subject}.`,
            sections: [{ title: 'Overview Section', content: chunkText.substring(0, 400) }],
            keyConcepts: [{ concept: topic, explanation: 'Key concept derived from study content.' }],
            importantFacts: [chunkText.substring(0, 150)],
            revisionPoints: [`Practice PYQs for ${topic}.`]
          };
        }
      }

      // 3. MCQs / Practice Test
      if (generationType === 'MCQS' || generationType === 'PRACTICE_TEST' || generationType === 'ALL') {
        try {
          const countForChunk = Math.max(2, Math.ceil(mcqCount / chunks.length));
          const prompt = buildMcqPrompt(chunkText, subject, topic, exam, difficulty, countForChunk);
          const rawOutput = await executeGeminiPrompt(prompt);
          const parsed = parseCleanJSON(rawOutput);

          if (parsed && Array.isArray(parsed.mcqs)) {
            for (const rawQ of parsed.mcqs) {
              const valQ = validateMCQSchema(rawQ, subject, topic);
              if (valQ) {
                const normText = valQ.question.toLowerCase().replace(/[^\w\s]/gi, '').trim();
                const existing = await Question.findOne({ question: valQ.question.trim() });
                valQ.duplicateFlag = !!existing;
                accumulatedMcqs.push(valQ);
              }
            }
          }
        } catch (err) {
          console.warn(`[AI Job ${jobId}] Chunk ${i + 1} Gemini MCQs fallback: ${err.message}`);
          // Fallback MCQ generation strictly from chunk text
          const firstSentence = chunkText.split(/(?<=[.!?])\s+/)[0] || 'Which provision is associated with this topic?';
          const fallbackQ = validateMCQSchema({
            question: `Which key provision accurately describes: "${firstSentence.substring(0, 70)}..."?`,
            options: [
              `Primary rule governing ${topic}`,
              `Secondary unrelated rule`,
              `Outdated administrative rule`,
              `None of the above`
            ],
            correct_answer: 0,
            explanation: `Option A accurately reflects the study content provision for ${topic}.`,
            subject,
            topic,
            difficulty,
            source_reference: `Chunk ${i + 1}`
          }, subject, topic);

          if (fallbackQ) {
            const existing = await Question.findOne({ question: fallbackQ.question.trim() });
            fallbackQ.duplicateFlag = !!existing;
            accumulatedMcqs.push(fallbackQ);
          }
        }
      }

      completedChunks++;
      job.completedChunks = completedChunks;
      await job.save();
    }

    // Save generated MCQs to Pending Review Queue (NEVER auto-publish!)
    const savedPendingMCQs = [];
    let duplicateCount = 0;

    for (const q of accumulatedMcqs) {
      if (q.duplicateFlag) duplicateCount++;
      const newQ = await Question.create({
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        subject: q.subject || subject,
        topic: q.topic || topic,
        exam: exam || 'General',
        difficulty: q.difficulty || difficulty,
        source: job.sourceDocumentName,
        sourceType: 'AI_GENERATED',
        sourceReference: q.sourceReference,
        tags: q.tags,
        duplicateFlag: q.duplicateFlag,
        verified: false,
        status: 'PENDING_REVIEW', // QUEUED FOR ADMIN REVIEW
        createdBy: createdBy
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
        status: 'PENDING_REVIEW'
      });
    }

    job.status = 'COMPLETED';
    job.oneLiners = accumulatedOneLiners;
    job.studyNotes = accumulatedStudyNotes || { title: `${subject} - ${topic}`, overview: 'Generated content notes' };
    job.generatedMcqs = savedPendingMCQs;
    job.generatedOneLinersCount = accumulatedOneLiners.length;
    job.generatedNotesCount = accumulatedStudyNotes ? 1 : 0;
    job.generatedMcqCount = savedPendingMCQs.length;
    job.duplicateCount = duplicateCount;
    job.pendingReviewCount = savedPendingMCQs.length;
    await job.save();

    return job;
  } catch (err) {
    job.status = 'FAILED';
    job.errorDetails = err.message;
    await job.save();
    throw err;
  }
};
