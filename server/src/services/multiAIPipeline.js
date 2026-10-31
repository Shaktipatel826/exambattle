/**
 * Multi-AI Pipeline Orchestrator — Intelligent Two-Phase Design
 *
 * Phase 1 — UNDERSTAND (Gemini)
 *   Each text chunk is passed to Gemini which extracts structured facts
 *   (events, people, dates, numbers, schemes, relationships).
 *   Facts from all chunks are merged into a shared "knowledge base".
 *
 * Phase 2 — GENERATE from knowledge (Gemini → Groq → OpenRouter)
 *   The knowledge base is split into question-generation chunks.
 *   Gemini generates intelligent, exam-oriented MCQs from the structured facts.
 *   Groq adds three plausible distractors per question.
 *   OpenRouter independently verifies correctness.
 *   A deduplication layer removes near-duplicate questions.
 *
 * This mirrors how a competent human tutor works: read & understand first,
 * then write questions — not mechanically convert lines into questions.
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

// ─── Constants ────────────────────────────────────────────────────────────────

const PIPELINE_TIMEOUT_MS = 110000; // 110 s hard ceiling
const UNDERSTAND_CHUNK_SIZE = 5000; // chars per comprehension chunk (Phase 1)
const UNDERSTAND_OVERLAP = 400;     // overlap between comprehension chunks (context preservation)
const GENERATE_CHUNK_SIZE = 6000;   // chars of facts per generation chunk (Phase 2)

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeQuestionText(text = '') {
  return text
    .toLowerCase()
    // keep Devanagari + ASCII word chars
    .replace(/[^\w\s\u0900-\u097F]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegex(str = '') {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Fisher-Yates shuffle; returns new index of `correct` after shuffle */
function shufflePlaceholders(options, correct) {
  const arr = [...options];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return { options: arr, correctIndex: arr.indexOf(correct) };
}

/**
 * Split text into overlapping chunks of roughly `size` chars.
 * We split on sentence boundaries ('. ' or '\n') where possible.
 */
function splitIntoOverlappingChunks(text, size = UNDERSTAND_CHUNK_SIZE, overlap = UNDERSTAND_OVERLAP) {
  if (text.length <= size) return [text];

  const chunks = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + size, text.length);

    // Try to break at a sentence/line boundary near `end`
    if (end < text.length) {
      const sliceToSearch = text.slice(Math.max(end - 300, start), end);
      const lastBreak = Math.max(
        sliceToSearch.lastIndexOf('। '),   // Hindi danda
        sliceToSearch.lastIndexOf('. '),
        sliceToSearch.lastIndexOf('\n'),
        sliceToSearch.lastIndexOf('? '),
        sliceToSearch.lastIndexOf('! ')
      );
      if (lastBreak > 50) {
        end = Math.max(end - 300, start) + lastBreak + 1;
      }
    }

    chunks.push(text.slice(start, end).trim());
    start = Math.max(start + 1, end - overlap); // move forward but keep overlap
  }

  return chunks.filter(c => c.length > 50);
}

/**
 * Split a facts string into non-overlapping chunks for question generation.
 */
function splitFactsIntoChunks(facts, size = GENERATE_CHUNK_SIZE) {
  if (facts.length <= size) return [facts];
  const lines = facts.split('\n');
  const chunks = [];
  let current = '';
  for (const line of lines) {
    if ((current + '\n' + line).length > size && current) {
      chunks.push(current.trim());
      current = line;
    } else {
      current += (current ? '\n' : '') + line;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

// ─── Phase 1: Comprehension (Gemini) ─────────────────────────────────────────

/**
 * Ask Gemini to read a chunk of raw source text and extract structured facts.
 * Returns a multi-line bullet list of facts in the target language.
 * This is the "understanding" phase — no questions yet.
 */
async function extractFactsFromChunk(chunkText, subject, language, chunkIndex, totalChunks) {
  const langInstruction =
    language === 'hi'
      ? 'तथ्यों को हिंदी (देवनागरी) में लिखें।'
      : language === 'bilingual'
      ? 'Write facts mixing Hindi and English naturally.'
      : 'Write facts in English.';

  const prompt = `You are an expert study assistant helping students prepare for Indian competitive exams (SSC CGL, Railway NTPC, UP Police, Banking, State PSC).

You have been given a segment of study material (chunk ${chunkIndex + 1} of ${totalChunks}).
Subject: ${subject}

SOURCE TEXT:
"""
${chunkText}
"""

Your task: Read and understand this material thoroughly. Extract ALL important facts, events, people, dates, statistics, schemes, organizations, laws, relationships, and concepts actually discussed in this text.

Language instruction: ${langInstruction}

Output format — write one fact per line, starting with a bullet (•). Be precise and specific:
• [fact 1]
• [fact 2]
...

Rules:
- Only extract facts explicitly present in the source text. Do NOT invent.
- Include numbers, dates, names, and specific details exactly as stated.
- If the text is conversational/lecture style, extract the information being taught, not the teaching dialogue itself.
- If a topic is incomplete in this chunk, extract what is available and note it with "(continued in next segment)" if applicable.
- Minimum 3 facts if any exist; do not output empty if the text contains information.
- Do NOT generate questions yet. Only facts.`;

  try {
    const rawText = await executeGeminiPrompt(prompt, undefined, 30000, 1);

    // ── Robust multi-format fact parsing ─────────────────────────────────────
    // Gemini may respond with:
    //   • bullet  — •, -, *, ◦, ▪, ●
    //   1. numbered lists — 1., 2., (1), (a)
    //   **Bold header** followed by content
    //   Plain lines with no marker
    // We accept ALL non-empty non-header lines.

    const BULLET_RE = /^(?:[•◦▪●]|- |\d+[.)]\s|[（(][0-9a-z][)）]\s?)/u;
    // Asterisk bullets only if NOT a markdown bold label (**text:**)
    const ASTERISK_BULLET_RE = /^\* /;
    const HEADER_RE = /^(?:#{1,3}\s|\*{1,2}[^*]+\*{1,2}:?\s*$|facts?:?\s*$|key\s+points?:?\s*$|तथ्य:?\s*$|मुख्य\s+बिंदु:?\s*$)/iu;
    const MARKDOWN_RE = /^```|^---+$|^\*{3,}$|^\s*$/;

    const lines = rawText.split('\n').map(l => l.trim());

    // First try: prefer lines with recognised bullet markers
    let facts = lines
      .filter(l => l && !HEADER_RE.test(l) && (BULLET_RE.test(l) || ASTERISK_BULLET_RE.test(l)))
      .map(l => l.replace(/^(?:[•◦▪●] ?|- |\* |\d+[.)]\s+|[（(][0-9a-z][)）]\s*)/, '').trim())
      .filter(l => l.length > 5);

    // Second try: if Gemini returned no bullet markers at all, fall back to
    // every non-empty, non-header, non-markdown line (plain paragraph style)
    if (facts.length === 0) {
      facts = lines
        .filter(l => l.length > 10 && !HEADER_RE.test(l) && !MARKDOWN_RE.test(l))
        .map(l =>
          // Strip any residual inline markdown (**, __, `)
          l.replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1').replace(/`([^`]+)`/g, '$1').trim()
        )
        .filter(l => l.length > 5);
    }

    // Log for diagnosis (safe — no key or PII in rawText preview)
    if (facts.length === 0) {
      console.warn(
        `[Phase1] Chunk ${chunkIndex + 1}: Gemini responded but 0 facts parsed. ` +
        `Raw preview (first 300 chars): ${rawText.substring(0, 300).replace(/\n/g, '↵')}`
      );
    } else {
      console.log(`[Phase1] Chunk ${chunkIndex + 1}: ${facts.length} facts parsed from Gemini response.`);
    }

    return facts;
  } catch (err) {
    // Categorise the error for the caller so stats are meaningful
    const category =
      err.message.includes('API_KEY') || err.message.includes('401') || err.message.includes('403')
        ? 'AUTH_ERROR'
        : err.message.includes('429') || err.message.toLowerCase().includes('quota') || err.message.toLowerCase().includes('rate limit')
        ? 'RATE_LIMIT'
        : err.message.includes('timed out') || err.message.includes('timeout')
        ? 'TIMEOUT'
        : err.message.includes('404') || err.message.includes('not found') || err.message.includes('fallbacks failed')
        ? 'MODEL_NOT_FOUND'
        : 'API_ERROR';

    console.warn(`[Phase1] Chunk ${chunkIndex + 1} failed [${category}]: ${err.message}`);
    // Attach category so _runPipeline can surface a useful error message
    const tagged = new Error(err.message);
    tagged.category = category;
    // Still return [] — don't throw; the caller handles partial failures
    // but store last error for reporting
    extractFactsFromChunk._lastError = tagged;
    return [];
  }
}

// ─── Phase 2: Question Generation (Gemini) ───────────────────────────────────

/**
 * Build the question-generation prompt.
 * Input is now structured facts (not raw source text), which Gemini handles
 * far more reliably than conversational transcript prose.
 */
function buildQuestionGenerationPrompt(factsText, subject, topic, exam, difficulty, count, language, coveredTopics) {
  const langInstruction =
    language === 'hi'
      ? 'प्रश्न और उत्तर हिंदी (देवनागरी) में लिखें।'
      : language === 'bilingual'
      ? 'Write questions naturally mixing Hindi and English as appropriate for competitive exams.'
      : 'Write questions in English.';

  const coveredHint = coveredTopics.size > 0
    ? `\nAlready-covered topics (avoid duplicating): ${[...coveredTopics].slice(-20).join(', ')}`
    : '';

  return `You are an expert MCQ writer for Indian competitive exams (${exam || 'SSC CGL, Railway NTPC, UP Police, Banking'}).

You have been given a set of VERIFIED FACTS from study material about "${subject}" — topic: "${topic}".

FACTS:
"""
${factsText}
"""
${coveredHint}

Task: Generate up to ${count} high-quality, exam-oriented MCQs based STRICTLY on these facts.
Language: ${langInstruction}
Difficulty: ${difficulty}

Question types to include (where facts support them):
- Direct factual (What/Who/When/Where/How many)
- Conceptual (What does X mean / Why was Y done)
- Statement-based (Which of the following is correct about X)
- Relationship (X is related to Y in what way)

Rules:
1. Every question must be answerable from the facts above. Do NOT invent.
2. Generate ONLY the question and ONE correct answer — NOT distractors (another AI adds those).
3. Avoid near-duplicate questions. Each question must test a distinct fact.
4. If fewer than ${count} good questions are possible from these facts, generate only the good ones.
5. Include topic, difficulty, language, and a short explanation citing the fact.
6. correctAnswer must be the exact text of the correct answer (not an index).

Respond with ONLY valid JSON:
{
  "questions": [
    {
      "question": "question text",
      "correctAnswer": "exact correct answer text",
      "topic": "specific sub-topic",
      "difficulty": "Easy|Medium|Hard",
      "language": "en|hi|bilingual",
      "explanation": "brief explanation citing the source fact",
      "sourceEvidence": "the specific fact that supports this answer"
    }
  ]
}`;
}

async function geminiGenerateQA(factsText, subject, topic, exam, difficulty, count, language, coveredTopics) {
  const prompt = buildQuestionGenerationPrompt(factsText, subject, topic, exam, difficulty, count, language, coveredTopics);
  const rawText = await executeGeminiPrompt(prompt, undefined, 35000, 1);

  let parsed;
  try {
    const clean = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    // Handle cases where Gemini wraps in extra text before/after JSON
    const jsonMatch = clean.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : clean);
  } catch {
    throw new Error(`Gemini returned invalid JSON: ${rawText.substring(0, 300)}`);
  }

  if (!Array.isArray(parsed.questions)) {
    throw new Error('Gemini response missing "questions" array.');
  }

  return parsed.questions.filter(q =>
    q.question && typeof q.question === 'string' && q.question.trim().length > 5 &&
    q.correctAnswer && typeof q.correctAnswer === 'string' && q.correctAnswer.trim().length > 0
  );
}

// ─── Groq: Distractor Generation ─────────────────────────────────────────────

async function groqAddDistractors(qaItem, subject, contextHint) {
  const result = await generateDistractors(
    qaItem.question,
    qaItem.correctAnswer,
    contextHint || '',
    subject
  );
  return {
    ...qaItem,
    options: result.options,
    correctAnswer: result.correctAnswer,
    distractors: result.distractors,
    groqProvider: result.provider
  };
}

// ─── OpenRouter: Verification ────────────────────────────────────────────────

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
      correctAnswer:
        result.verdict === 'FAIL' && result.confidence === 'HIGH'
          ? result.correctAnswerIndex
          : mcqItem.correctAnswer,
      verifierCorrected: result.verdict === 'FAIL' && result.confidence === 'HIGH',
      openRouterProvider: result.provider
    };
  } catch (verifyErr) {
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

// ─── Schema Validation ────────────────────────────────────────────────────────

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
    _pipeline: {
      geminiQuestion: true,
      groqDistractors: q.groqProvider === 'groq',
      openRouterVerdict: q.verifierVerdict || 'SKIPPED',
      openRouterConfidence: q.verifierConfidence || 'LOW',
      verifierCorrected: q.verifierCorrected || false
    }
  };
}

// ─── Main Pipeline Export ─────────────────────────────────────────────────────

/**
 * Run the full two-phase intelligent pipeline.
 *
 * @param {object} opts
 *   opts.extractedText      {string}  — clean text from document or pasted input
 *   opts.subject            {string}
 *   opts.topic              {string}
 *   opts.exam               {string}
 *   opts.difficulty         {string}  Easy|Medium|Hard|All
 *   opts.questionCount      {number}  target (no hard cap)
 *   opts.language           {string}  en|hi|bilingual
 *   opts.mode               {string}  quick|comprehensive
 *   opts.sourceDocumentName {string}
 *   opts.createdBy          {string}
 *   opts.skipGroq           {boolean}
 *   opts.skipVerification   {boolean}
 *
 * @returns {{ questions: MCQ[], stats: object }}
 */
export const runDocToTestPipeline = async (opts) => {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error('Pipeline timed out after 110 s. Try "Skip Verification", shorter material, or fewer questions.')),
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

  const stats = {
    phase: 'starting',
    understandChunksTotal: 0,
    understandChunksDone: 0,
    understandChunksFailed: 0,
    factsExtracted: 0,
    generateChunksTotal: 0,
    generateChunksDone: 0,
    generateChunksFailed: 0,
    geminiGenerated: 0,
    groqSuccess: 0,
    groqFailed: 0,
    openRouterPass: 0,
    openRouterFail: 0,
    openRouterSkipped: 0,
    openRouterCorrected: 0,
    validationFailed: 0,
    deduplicatedLocally: 0,
    finalCount: 0
  };

  // ══════════════════════════════════════════════════════════════════
  // PHASE 1: UNDERSTAND — extract structured facts from raw text
  // ══════════════════════════════════════════════════════════════════
  stats.phase = 'understanding';

  // Build overlapping comprehension chunks
  const understandChunks = splitIntoOverlappingChunks(
    extractedText.trim(),
    UNDERSTAND_CHUNK_SIZE,
    UNDERSTAND_OVERLAP
  );
  stats.understandChunksTotal = understandChunks.length;

  console.log(`[Pipeline] Phase 1 — Understanding ${understandChunks.length} chunk(s) of source material...`);

  const allFacts = [];

  for (let ci = 0; ci < understandChunks.length; ci++) {
    const chunk = understandChunks[ci];
    console.log(`[Phase1] Chunk ${ci + 1}/${understandChunks.length} (${chunk.length} chars) — extracting facts...`);
    const facts = await extractFactsFromChunk(chunk, subject, language, ci, understandChunks.length);
    if (facts.length > 0) {
      allFacts.push(...facts);
      stats.understandChunksDone++;
      console.log(`[Phase1] Chunk ${ci + 1}: ${facts.length} facts extracted`);
    } else {
      stats.understandChunksFailed++;
      console.warn(`[Phase1] Chunk ${ci + 1}: no facts extracted`);
    }

    // In quick mode, stop Phase 1 early once we have enough raw material
    // (a generous estimate: ~3 facts per question needed)
    if (mode === 'quick' && allFacts.length >= questionCount * 3) {
      console.log(`[Phase1] Quick mode: sufficient facts (${allFacts.length}) gathered. Stopping early.`);
      break;
    }
  }

  stats.factsExtracted = allFacts.length;

  if (allFacts.length === 0) {
    // Determine why Phase 1 produced nothing: API error vs genuinely empty content
    const lastErr = extractFactsFromChunk._lastError;
    const failCategory = lastErr?.category || 'UNKNOWN';

    // Mark that the fallback is running (so route diagnostics are accurate)
    stats.phase1FallbackReason = failCategory;
    stats.phase1LastError = lastErr?.message?.substring(0, 200) || 'No facts parsed from Gemini response';

    if (failCategory === 'AUTH_ERROR') {
      // Hard stop — retrying won't help
      throw new Error(
        'Gemini authentication failed (401/403). Check that GEMINI_API_KEY is set correctly in the Render environment.'
      );
    }

    // Fall back: use raw text directly
    console.warn(`[Phase1] No facts extracted (reason: ${failCategory}). Falling back to raw-text generation.`);
    stats.usingFallback = true;
    return _runRawTextPipeline({ extractedText, subject, topic, exam, difficulty, questionCount, language, mode, sourceDocumentName, createdBy, skipGroq, skipVerification, stats });
  }

  // Deduplicate facts (case-insensitive)
  const seenFacts = new Set();
  const uniqueFacts = allFacts.filter(f => {
    const norm = f.toLowerCase().replace(/\s+/g, ' ').trim();
    if (seenFacts.has(norm)) return false;
    seenFacts.add(norm);
    return true;
  });

  const knowledgeBase = uniqueFacts.map(f => `• ${f}`).join('\n');

  console.log(`[Pipeline] Phase 1 complete. ${uniqueFacts.length} unique facts in knowledge base.`);

  // ══════════════════════════════════════════════════════════════════
  // PHASE 2: GENERATE — create MCQs from structured knowledge base
  // ══════════════════════════════════════════════════════════════════
  stats.phase = 'generating';

  // Split knowledge base into generation chunks
  const generateChunks = splitFactsIntoChunks(knowledgeBase, GENERATE_CHUNK_SIZE);
  stats.generateChunksTotal = generateChunks.length;

  // How many questions per generation chunk
  const questionsPerChunk = mode === 'comprehensive'
    ? Math.max(5, Math.ceil(questionCount / Math.max(generateChunks.length, 1)))
    : Math.max(3, Math.ceil(questionCount / Math.max(generateChunks.length, 1)));

  console.log(`[Pipeline] Phase 2 — Generating from ${generateChunks.length} knowledge chunk(s), ~${questionsPerChunk} Qs each...`);

  const assembled = [];
  const seenNorm = new Set();
  const coveredTopics = new Set();

  for (let ci = 0; ci < generateChunks.length; ci++) {
    const factsText = generateChunks[ci];
    console.log(`[Phase2] Chunk ${ci + 1}/${generateChunks.length} (${factsText.length} chars facts) — requesting ${questionsPerChunk} Qs`);

    // ── Gemini: Generate Q+A from facts ──
    let qaItems = [];
    try {
      qaItems = await geminiGenerateQA(factsText, subject, topic, exam, difficulty, questionsPerChunk, language, coveredTopics);
      stats.geminiGenerated += qaItems.length;
      stats.generateChunksDone++;
      qaItems.forEach(q => { if (q.topic) coveredTopics.add(q.topic); });
      console.log(`[Phase2] Gemini: ${qaItems.length} Q+A pairs from chunk ${ci + 1}`);
    } catch (geminiErr) {
      stats.generateChunksFailed++;
      console.warn(`[Phase2] Gemini chunk ${ci + 1} error: ${geminiErr.message}`);
      continue;
    }

    for (const qaItem of qaItems) {
      // Dedup
      const norm = normalizeQuestionText(qaItem.question);
      if (seenNorm.has(norm)) {
        stats.deduplicatedLocally++;
        continue;
      }
      seenNorm.add(norm);

      let mcqWithOptions;

      // ── Groq: Add distractors ──
      if (!skipGroq) {
        try {
          mcqWithOptions = await groqAddDistractors(qaItem, subject, factsText.substring(0, 600));
          stats.groqSuccess++;
        } catch (groqErr) {
          stats.groqFailed++;
          console.warn(`[Phase2] Groq failed: ${groqErr.message.substring(0, 100)}`);
          // Fallback: placeholder distractors
          const rawOpts = [qaItem.correctAnswer, 'इनमें से कोई नहीं / None of these', 'उपरोक्त सभी / All of the above', 'ज्ञात नहीं / Not mentioned'];
          const shuffled = shufflePlaceholders(rawOpts, qaItem.correctAnswer);
          mcqWithOptions = { ...qaItem, options: shuffled.options, correctAnswer: shuffled.correctIndex, distractors: [], groqProvider: 'fallback' };
        }
      } else {
        const rawOpts = [qaItem.correctAnswer, 'Option B', 'Option C', 'Option D'];
        const shuffled = shufflePlaceholders(rawOpts, qaItem.correctAnswer);
        mcqWithOptions = { ...qaItem, options: shuffled.options, correctAnswer: shuffled.correctIndex };
      }

      mcqWithOptions.sourceDocumentName = sourceDocumentName;

      // ── OpenRouter: Verify ──
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

      // ── Schema validation ──
      const validated = validateMCQItem(verifiedMcq, subject, topic, exam);
      if (!validated) {
        stats.validationFailed++;
        continue;
      }

      validated.createdBy = createdBy;
      assembled.push(validated);

      // Quick mode: stop once we have enough questions
      if (mode === 'quick' && assembled.length >= questionCount) break;
    }

    if (mode === 'quick' && assembled.length >= questionCount) break;
  }

  stats.finalCount = assembled.length;
  stats.phase = 'complete';
  console.log(`[Pipeline] Complete. Stats:`, JSON.stringify(stats));

  return { questions: assembled, stats };
}

// ─── Fallback: raw-text generation (used when Phase 1 produces zero facts) ───

async function _runRawTextPipeline({
  extractedText, subject, topic, exam, difficulty, questionCount,
  language, mode, sourceDocumentName, createdBy, skipGroq, skipVerification, stats
}) {
  const CHUNK_SIZE = 4000;
  const chunks = splitIntoOverlappingChunks(extractedText, CHUNK_SIZE, 300);
  const questionsPerChunk = Math.max(3, Math.ceil(questionCount / Math.max(chunks.length, 1)));

  const assembled = [];
  const seenNorm = new Set();

  for (let ci = 0; ci < chunks.length; ci++) {
    const chunkText = chunks[ci];

    // Use a simpler prompt for raw text (original Phase 2 style)
    const prompt = `You are an expert MCQ writer for Indian competitive exams.

Source Material:
"""
${chunkText}
"""

Task: Generate up to ${questionsPerChunk} factual MCQs STRICTLY from the source above.
Subject: ${subject}
Language: ${language === 'hi' ? 'Hindi (Devanagari)' : language === 'bilingual' ? 'Hindi/English mixed' : 'English'}
Difficulty: ${difficulty}

Rules:
1. Only use facts present in the source. Do NOT invent.
2. Output question + one correct answer only (no distractors).
3. If fewer than ${questionsPerChunk} good questions exist, output only the good ones.

Respond ONLY valid JSON: { "questions": [{ "question": "...", "correctAnswer": "...", "topic": "...", "difficulty": "Easy|Medium|Hard", "language": "en|hi|bilingual", "explanation": "..." }] }`;

    let qaItems = [];
    try {
      const rawText = await executeGeminiPrompt(prompt, undefined, 30000, 1);
      const clean = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      const jsonMatch = clean.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : clean);
      qaItems = (parsed.questions || []).filter(q =>
        q.question?.trim().length > 5 && q.correctAnswer?.trim().length > 0
      );
      stats.geminiGenerated += qaItems.length;
    } catch (err) {
      console.warn(`[Fallback] Gemini chunk ${ci + 1} error: ${err.message}`);
      continue;
    }

    for (const qaItem of qaItems) {
      const norm = normalizeQuestionText(qaItem.question);
      if (seenNorm.has(norm)) { stats.deduplicatedLocally++; continue; }
      seenNorm.add(norm);

      let mcqWithOptions;
      if (!skipGroq) {
        try {
          mcqWithOptions = await groqAddDistractors(qaItem, subject, chunkText.substring(0, 600));
          stats.groqSuccess++;
        } catch {
          stats.groqFailed++;
          const rawOpts = [qaItem.correctAnswer, 'Option B (review)', 'Option C (review)', 'Option D (review)'];
          const shuffled = shufflePlaceholders(rawOpts, qaItem.correctAnswer);
          mcqWithOptions = { ...qaItem, options: shuffled.options, correctAnswer: shuffled.correctIndex, distractors: [] };
        }
      } else {
        const rawOpts = [qaItem.correctAnswer, 'Option B', 'Option C', 'Option D'];
        const shuffled = shufflePlaceholders(rawOpts, qaItem.correctAnswer);
        mcqWithOptions = { ...qaItem, options: shuffled.options, correctAnswer: shuffled.correctIndex };
      }

      mcqWithOptions.sourceDocumentName = sourceDocumentName;

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

      const validated = validateMCQItem(verifiedMcq, subject, topic, exam);
      if (!validated) { stats.validationFailed++; continue; }

      validated.createdBy = createdBy;
      assembled.push(validated);

      if (mode === 'quick' && assembled.length >= questionCount) break;
    }
    if (mode === 'quick' && assembled.length >= questionCount) break;
  }

  stats.finalCount = assembled.length;
  stats.phase = 'complete';
  console.log(`[Pipeline/Fallback] Complete. Stats:`, JSON.stringify(stats));
  return { questions: assembled, stats };
}

// ─── Save Validated Questions to MongoDB ─────────────────────────────────────

/**
 * Save a preview batch to MongoDB Question collection.
 * Skips exact-text duplicates already in DB.
 */
export const validateAndSaveQuestions = async (questions, { createdBy = 'Admin', status = 'PENDING_REVIEW' } = {}) => {
  let saved = 0;
  let skipped = 0;
  const errors = [];

  for (const q of questions) {
    try {
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
