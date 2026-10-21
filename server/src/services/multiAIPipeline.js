/**
 * Multi-AI Pipeline Orchestrator
 *
 * Complete flow:
 *   Step 1 — Text extraction (caller is responsible; pass extractedText)
 *   Step 2 — Gemini: generates question + intended correct answer + topic/difficulty/explanation
 *   Step 3 — Groq: generates 3 plausible distractors for each question
 *   Step 4 — OpenRouter: independently verifies each assembled MCQ
 *   Step 5 — Backend validation: enforces schema rules + deduplication
 *   Step 6 — Return preview array ready for UI → Admin save → create room
 *
 * AI keys are read from process.env only. Never hardcoded.
 *
 * Exports:
 *   runDocToTestPipeline(options) → { questions[], stats }
 *   validateAndSaveQuestions(questions, opts) → { saved, skipped, errors }
 */

import { executeGeminiPrompt } from './ai/geminiProvider.js';
import { generateDistractors } from './groq.js';
import { verifyMCQ } from './openrouter.js';
import { Question } from '../models/Question.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeQuestionText(text = '') {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegex(str = '') {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Shuffle an options array and track where the correct answer ended up.
 * Uses Fisher-Yates so correctAnswer is never predictably at index 0.
 * @param {string[]} options  — all 4 options (correct + 3 others)
 * @param {string}   correct  — the text of the correct answer
 * @returns {{ options: string[], correctIndex: number }}
 */
function shufflePlaceholders(options, correct) {
  const arr = [...options];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return { options: arr, correctIndex: arr.indexOf(correct) };
}

/**
 * Build a Gemini prompt for question+answer generation (no distractors).
 * Strict: only factual questions grounded in source text.
 */
function buildGeminiQAPrompt(chunkText, subject, topic, exam, difficulty, count, language) {
  return `You are an expert MCQ question writer for Indian competitive exams (SSC CGL, Railway NTPC, UP Police, Banking).

Source Material:
"""
${chunkText}
"""

Task: Extract exactly ${count} factual questions STRICTLY from the source material above.
Subject: ${subject}
Topic: ${topic}
Exam: ${exam}
Difficulty: ${difficulty}
Language: ${language === 'hi' ? 'Generate questions and answers in Hindi (Devanagari script)' : language === 'bilingual' ? 'Generate questions mixing Hindi and English naturally as appropriate' : 'Generate questions in English'}

Rules:
1. Each question must be directly answerable from the source text.
2. Do NOT invent facts not present in the source.
3. If source does not contain ${count} distinct facts, return only what is available (fewer questions is better than invented questions).
4. Each question needs ONLY the question text + one correct answer (NOT distractors — another AI will add those).
5. Include: topic, difficulty (Easy/Medium/Hard), language (en/hi/bilingual), a short explanation citing the source.

Respond with ONLY valid JSON:
{
  "questions": [
    {
      "question": "question text",
      "correctAnswer": "the exact correct answer text (not index)",
      "topic": "specific topic",
      "difficulty": "Easy|Medium|Hard",
      "language": "en|hi|bilingual",
      "explanation": "brief factual explanation with source reference",
      "sourceEvidence": "exact quote or paraphrase from source that supports this answer"
    }
  ]
}`;
}

// ─── Step 2: Gemini Q+A Generation ───────────────────────────────────────────

async function geminiGenerateQA(chunkText, subject, topic, exam, difficulty, countPerChunk = 5, language = 'en') {
  const prompt = buildGeminiQAPrompt(chunkText, subject, topic, exam, difficulty, countPerChunk, language);
  const rawText = await executeGeminiPrompt(prompt);

  let parsed;
  try {
    const clean = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    parsed = JSON.parse(clean);
  } catch {
    throw new Error(`Gemini returned invalid JSON: ${rawText.substring(0, 200)}`);
  }

  if (!Array.isArray(parsed.questions)) {
    throw new Error('Gemini response missing "questions" array.');
  }

  return parsed.questions.filter(q =>
    q.question && typeof q.question === 'string' && q.question.trim().length > 5 &&
    q.correctAnswer && typeof q.correctAnswer === 'string' && q.correctAnswer.trim().length > 0
  );
}

// ─── Step 3: Groq Distractor Generation ──────────────────────────────────────

async function groqAddDistractors(qaItem, subject, sourceContext) {
  const result = await generateDistractors(
    qaItem.question,
    qaItem.correctAnswer,
    sourceContext,
    subject
  );
  return {
    ...qaItem,
    options: result.options,
    correctAnswer: result.correctAnswer, // now a 0-indexed number
    distractors: result.distractors,
    groqProvider: result.provider
  };
}

// ─── Step 4: OpenRouter Verification ─────────────────────────────────────────

async function openRouterVerify(mcqItem, subject) {
  try {
    const result = await verifyMCQ({
      question: mcqItem.question,
      options: mcqItem.options,
      correctAnswer: mcqItem.correctAnswer,
      explanation: mcqItem.explanation || '',
      subject
    });

    return {
      ...mcqItem,
      verifierVerdict: result.verdict,
      verifierConfidence: result.confidence,
      verifierReasoning: result.reasoning,
      // If FAIL with HIGH confidence, correct the answer index
      correctAnswer:
        result.verdict === 'FAIL' && result.confidence === 'HIGH'
          ? result.correctAnswerIndex
          : mcqItem.correctAnswer,
      verifierCorrected: result.verdict === 'FAIL' && result.confidence === 'HIGH',
      openRouterProvider: result.provider
    };
  } catch (verifyErr) {
    // Verification optional — don't block the pipeline
    console.warn(`[OpenRouter] Verification skipped for "${mcqItem.question.substring(0, 50)}": ${verifyErr.message}`);
    return {
      ...mcqItem,
      verifierVerdict: 'SKIPPED',
      verifierConfidence: 'LOW',
      verifierReasoning: verifyErr.message,
      verifierCorrected: false
    };
  }
}

// ─── Step 5: Backend Validation ───────────────────────────────────────────────

function validateMCQItem(q, subject, topic, exam) {
  if (!q.question || typeof q.question !== 'string' || q.question.trim().length < 5) return null;
  if (!Array.isArray(q.options) || q.options.length !== 4) return null;
  if (q.options.some(opt => typeof opt !== 'string' || opt.trim().length === 0)) return null;
  const ca = typeof q.correctAnswer === 'number' ? q.correctAnswer : parseInt(q.correctAnswer, 10);
  if (isNaN(ca) || ca < 0 || ca > 3) return null;

  const diffMap = { Easy: true, Medium: true, Hard: true };
  const diff = diffMap[q.difficulty] ? q.difficulty : 'Medium';

  return {
    question: q.question.trim(),
    options: q.options.map(o => o.trim()),
    correctAnswer: ca,
    explanation: (q.explanation || '').trim() || 'Derived from uploaded study material.',
    subject,
    topic: q.topic || topic,
    exam: exam || 'General',
    difficulty: diff,
    language: ['en', 'hi', 'bilingual'].includes(q.language) ? q.language : 'en',
    sourceType: 'SOURCE_BASED',
    source: q.sourceDocumentName || 'Document',
    sourceReference: q.sourceEvidence ? q.sourceEvidence.substring(0, 300) : '',
    tags: [subject, q.topic || topic].filter(Boolean),
    verified: false,
    status: 'PENDING_REVIEW',
    // Metadata for transparency
    _pipeline: {
      geminiQuestion: true,
      groqDistractors: q.groqProvider === 'groq',
      openRouterVerdict: q.verifierVerdict || 'SKIPPED',
      openRouterConfidence: q.verifierConfidence || 'LOW',
      verifierCorrected: q.verifierCorrected || false
    }
  };
}

// ─── Main Pipeline ────────────────────────────────────────────────────────────

/**
 * Run the full Gemini → Groq → OpenRouter → validate pipeline.
 *
 * @param {object} opts
 *   opts.extractedText     {string}  — clean text from document or pasted input
 *   opts.subject           {string}
 *   opts.topic             {string}
 *   opts.exam              {string}
 *   opts.difficulty        {string}  — Easy|Medium|Hard|All
 *   opts.questionCount     {number}  — target number of questions (default 10)
 *   opts.sourceDocumentName {string} — display name for source
 *   opts.createdBy         {string}
 *   opts.skipGroq          {boolean} — skip Groq step (use Gemini fallback distractors)
 *   opts.skipVerification  {boolean} — skip OpenRouter step
 *
 * @returns {object}
 *   {
 *     questions: MCQ[],   // validated preview questions (NOT yet saved)
 *     stats: {
 *       geminiGenerated, groqSuccess, groqFailed,
 *       openRouterPass, openRouterFail, openRouterSkipped, openRouterCorrected,
 *       validationFailed, deduplicatedLocally, finalCount
 *     }
 *   }
 */
// ─── Pipeline-level timeout: prevents permanent hang if AI providers stall ─────
const PIPELINE_TIMEOUT_MS = 110000; // 110 s — leaves headroom inside Render's 120 s proxy limit

export const runDocToTestPipeline = async (opts) => {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error('Pipeline timed out after 110 s. Return partial results or retry with fewer questions.')),
      PIPELINE_TIMEOUT_MS
    );
  });

  try {
    return await Promise.race([_runPipeline(opts), timeoutPromise]);
  } finally {
    clearTimeout(timeoutId);
  }
};

async function _runPipeline({
  extractedText,
  subject = 'General Studies',
  topic = 'General',
  exam = 'General',
  difficulty = 'Medium',
  questionCount = 10,
  language = 'en',
  mode = 'quick',
  sourceDocumentName = 'Document',
  createdBy = 'Admin',
  skipGroq = false,
  skipVerification = false
}) {
  if (!extractedText || extractedText.trim().length === 0) {
    throw new Error('No extracted text provided to pipeline.');
  }

  // Split text into ~4000-char chunks
  const CHUNK_SIZE = 4000;
  const chunks = [];
  const paragraphs = extractedText.trim().split(/\n\s*\n/);
  let current = '';
  for (const para of paragraphs) {
    if ((current.length + para.length) <= CHUNK_SIZE) {
      current += (current ? '\n\n' : '') + para;
    } else {
      if (current) chunks.push(current.trim());
      current = para;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  if (chunks.length === 0) chunks.push(extractedText.substring(0, CHUNK_SIZE));

  // In comprehensive mode, ask Gemini to extract as many facts as possible from each chunk.
  // In quick mode, spread questionCount evenly across chunks.
  const questionsPerChunk = mode === 'comprehensive'
    ? Math.max(5, Math.ceil(questionCount / Math.max(chunks.length, 1)))
    : Math.max(1, Math.ceil(questionCount / chunks.length));

  const stats = {
    geminiGenerated: 0,
    groqSuccess: 0,
    groqFailed: 0,
    openRouterPass: 0,
    openRouterFail: 0,
    openRouterSkipped: 0,
    openRouterCorrected: 0,
    validationFailed: 0,
    deduplicatedLocally: 0,
    finalCount: 0,
    chunksTotal: chunks.length,
    chunksProcessed: 0,
    chunksFailed: 0
  };

  const assembled = [];
  const seenNorm = new Set();

  for (let ci = 0; ci < chunks.length; ci++) {
    const chunkText = chunks[ci];
    console.log(`[Pipeline] Chunk ${ci + 1}/${chunks.length} (${chunkText.length} chars) — requesting ${questionsPerChunk} Qs`);

    // ── Step 2: Gemini ──
    let qaItems = [];
    try {
      qaItems = await geminiGenerateQA(chunkText, subject, topic, exam, difficulty, questionsPerChunk, language);
      stats.geminiGenerated += qaItems.length;
      stats.chunksProcessed++;
      console.log(`[Pipeline] Gemini: ${qaItems.length} Q+A pairs from chunk ${ci + 1}`);
    } catch (geminiErr) {
      stats.chunksFailed++;
      console.warn(`[Pipeline] Gemini chunk ${ci + 1} error: ${geminiErr.message}`);
      continue;
    }

    for (const qaItem of qaItems) {
      // Dedup within batch
      const norm = normalizeQuestionText(qaItem.question);
      if (seenNorm.has(norm)) {
        stats.deduplicatedLocally++;
        continue;
      }
      seenNorm.add(norm);

      let mcqWithOptions;

      // ── Step 3: Groq ──
      if (!skipGroq) {
        try {
          mcqWithOptions = await groqAddDistractors(qaItem, subject, chunkText);
          stats.groqSuccess++;
          console.log(`[Pipeline] Groq: distractors added for "${qaItem.question.substring(0, 40)}..."`);
        } catch (groqErr) {
          stats.groqFailed++;
          console.warn(`[Pipeline] Groq failed for Q: "${qaItem.question.substring(0, 40)}": ${groqErr.message}`);
          // Fallback: shuffle correct answer into a random position among placeholders
          const rawOptions = [
            qaItem.correctAnswer,
            'Option B (review required)',
            'Option C (review required)',
            'Option D (review required)'
          ];
          const shuffled = shufflePlaceholders(rawOptions, qaItem.correctAnswer);
          mcqWithOptions = {
            ...qaItem,
            options: shuffled.options,
            correctAnswer: shuffled.correctIndex,
            distractors: [],
            groqProvider: 'fallback'
          };
        }
      } else {
        // Skip Groq — shuffle correct answer into a random slot among placeholders
        const rawOptions = [qaItem.correctAnswer, 'Option B', 'Option C', 'Option D'];
        const shuffled = shufflePlaceholders(rawOptions, qaItem.correctAnswer);
        mcqWithOptions = {
          ...qaItem,
          options: shuffled.options,
          correctAnswer: shuffled.correctIndex
        };
      }

      mcqWithOptions.sourceDocumentName = sourceDocumentName;

      // ── Step 4: OpenRouter Verification ──
      let verifiedMcq;
      if (!skipVerification) {
        verifiedMcq = await openRouterVerify(mcqWithOptions, subject);
        if (verifiedMcq.verifierVerdict === 'PASS') stats.openRouterPass++;
        else if (verifiedMcq.verifierVerdict === 'FAIL') stats.openRouterFail++;
        else stats.openRouterSkipped++;
        if (verifiedMcq.verifierCorrected) stats.openRouterCorrected++;
      } else {
        verifiedMcq = { ...mcqWithOptions, verifierVerdict: 'SKIPPED' };
        stats.openRouterSkipped++;
      }

      // ── Step 5: Validate schema ──
      const validated = validateMCQItem(verifiedMcq, subject, topic, exam);
      if (!validated) {
        stats.validationFailed++;
        console.warn(`[Pipeline] Schema validation failed for "${mcqWithOptions.question?.substring(0, 40)}"`);
        continue;
      }

      validated.createdBy = createdBy;
      assembled.push(validated);

      // In 'quick' mode, stop as soon as we have enough questions
      if (mode === 'quick' && assembled.length >= questionCount) break;
    }

    // In 'quick' mode, stop processing further chunks once we have enough
    if (mode === 'quick' && assembled.length >= questionCount) break;
  }

  stats.finalCount = assembled.length;

  console.log(`[Pipeline] Complete. Stats:`, JSON.stringify(stats));
  return { questions: assembled, stats };
};

// ─── Save Validated Questions to MongoDB ─────────────────────────────────────

/**
 * Save a preview batch to MongoDB Question collection.
 * Skips exact-text duplicates already in DB.
 *
 * @param {object[]} questions  — validated MCQ objects from runDocToTestPipeline
 * @param {object} opts
 *   opts.createdBy   {string}
 *   opts.status      {string}   — 'PENDING_REVIEW' or 'PUBLISHED'
 *
 * @returns {{ saved: number, skipped: number, errors: string[] }}
 */
export const validateAndSaveQuestions = async (questions, { createdBy = 'Admin', status = 'PENDING_REVIEW' } = {}) => {
  let saved = 0;
  let skipped = 0;
  const errors = [];

  for (const q of questions) {
    try {
      // Check for existing question with same text (case-insensitive)
      const existing = await Question.findOne({
        question: { $regex: new RegExp(`^${escapeRegex(q.question.trim())}$`, 'i') }
      });

      if (existing) {
        skipped++;
        console.log(`[Save] Skipped duplicate: "${q.question.substring(0, 50)}"`);
        continue;
      }

      await Question.create({
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        subject: q.subject,
        topic: q.topic,
        exam: q.exam,
        difficulty: q.difficulty,
        language: q.language,
        source: q.source,
        sourceType: 'SOURCE_BASED',
        sourceReference: q.sourceReference,
        tags: q.tags,
        verified: false,
        status: status || 'PENDING_REVIEW',
        createdBy: createdBy || 'Admin',
        duplicateFlag: false
      });

      saved++;
    } catch (err) {
      errors.push(`"${q.question.substring(0, 40)}...": ${err.message}`);
      console.error(`[Save] Error saving question: ${err.message}`);
    }
  }

  console.log(`[Save] Done. Saved: ${saved}, Skipped (duplicates): ${skipped}, Errors: ${errors.length}`);
  return { saved, skipped, errors };
};
