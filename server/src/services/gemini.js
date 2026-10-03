import { GoogleGenerativeAI } from '@google/generative-ai';
import crypto from 'crypto';

let genAI = null;

function getGenAIClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim().length === 0 || apiKey === 'your_gemini_api_key_here') {
    return null;
  }
  if (!genAI) {
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

// In-Memory Cache for AI Study Pack deduplication
const aiCache = new Map();

/**
 * Generate MD5 Hash of text content for request deduplication
 */
export const getContentHash = (text) => {
  return crypto.createHash('md5').update(text.trim()).digest('hex');
};

/**
 * Execute Gemini model call with timeout & retry strategy
 */
async function callGeminiWithRetry(prompt, timeoutMs = 25000, maxRetries = 2) {
  const client = getGenAIClient();
  if (!client) throw new Error('GEMINI_API_KEY not configured.');

  const preferredModel = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
  const candidateModels = Array.from(new Set([preferredModel, 'gemini-3.8-flash', 'gemini-3.5-flash']));

  let lastError = null;

  for (const modelName of candidateModels) {
    const model = client.getGenerativeModel({ model: modelName });

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('AI Request Timeout after 25s')), timeoutMs)
        );

        const apiPromise = model.generateContent(prompt);
        const result = await Promise.race([apiPromise, timeoutPromise]);
        return result.response.text();
      } catch (err) {
        lastError = err;
        const isNotFound = err.message.includes('404') || err.message.includes('not found') || err.message.includes('is no longer available');
        if (isNotFound) {
          console.warn(`[AI Service Warning] Model ${modelName} returned unavailable/404. Trying fallback model...`);
          break;
        }
        if (attempt <= maxRetries) {
          console.warn(`[AI Service Warning] Model ${modelName} attempt ${attempt} failed: ${err.message}. Retrying...`);
          await new Promise(res => setTimeout(res, attempt * 1000));
        }
      }
    }
  }

  throw lastError || new Error('All Gemini model fallbacks failed.');
}

/**
 * Validates AI-generated MCQ JSON structure strictly according to prompt rules
 */
export function validateStructuredMCQ(q) {
  if (!q || typeof q !== 'object') return null;
  if (!q.question || typeof q.question !== 'string' || q.question.trim().length < 5) return null;
  if (!Array.isArray(q.options) || q.options.length !== 4) return null;
  if (q.options.some(opt => typeof opt !== 'string' || opt.trim().length === 0)) return null;

  let correctAnswer = typeof q.correctAnswer === 'number' ? q.correctAnswer : 0;
  if (correctAnswer < 0 || correctAnswer > 3) correctAnswer = 0;

  return {
    question: q.question.trim(),
    options: q.options.map(o => o.trim()),
    correctAnswer,
    explanation: q.explanation || 'Generated rationale based on study material.',
    sourceType: q.sourceType === 'AI_GENERATED' ? 'AI_GENERATED' : 'SOURCE_BASED',
    verified: false,
    status: 'PENDING_REVIEW'
  };
}

/**
 * Safe chunking & processing for large study text documents
 */
export const generateStudyPackWithAI = async (text, subject = 'General Studies', topic = 'General') => {
  const contentHash = getContentHash(text);
  if (aiCache.has(contentHash)) {
    console.log('[AI Service Cache] Reusing cached study pack for identical content.');
    return aiCache.get(contentHash);
  }

  const client = getGenAIClient();
  if (!client) {
    console.warn('[AI Service Warning] GEMINI_API_KEY missing. Using fallback rule generator.');
    return generateFallbackStudyPack(text, subject, topic);
  }

  try {
    // If text > 6,000 characters, chunk text safely into 4,000-char blocks
    const chunkSize = 4000;
    const textChunks = [];
    for (let i = 0; i < text.length; i += chunkSize) {
      textChunks.push(text.substring(i, i + chunkSize));
    }

    const aggregated = {
      shortNotes: [],
      oneLiners: [],
      keyConcepts: [],
      importantPoints: [],
      commonConfusions: [],
      newMCQs: [],
      revisionQuestions: []
    };

    // Process up to 3 chunks sequentially
    const maxChunksToProcess = Math.min(textChunks.length, 3);
    for (let idx = 0; idx < maxChunksToProcess; idx++) {
      const chunkText = textChunks[idx];
      const prompt = `
You are an expert competitive exam tutor for Indian exams (SSC, Railway, Banking, UP Police).
Analyze the following study material chunk ${idx + 1}/${maxChunksToProcess} and output JSON with:
1. "shortNotes": Array of 3 concise note bullets.
2. "oneLiners": Array of 4 single-line factual points.
3. "keyConcepts": Array of [{ "concept": "Name", "explanation": "Details" }].
4. "importantPoints": Array of 2 exam points.
5. "commonConfusions": Array of [{ "factA": "F1", "factB": "F2", "clarification": "Details" }].
6. "newMCQs": Array of 3 MCQs [{ "question": "Q", "options": ["A","B","C","D"], "correctAnswer": 0, "explanation": "Exp", "sourceType": "SOURCE_BASED" }].
7. "revisionQuestions": Array of [{ "question": "Q", "shortAnswer": "A" }].

Return ONLY valid JSON.
Study Content Chunk:
${chunkText}
      `;

      try {
        const rawResponse = await callGeminiWithRetry(prompt);
        const cleanJsonText = rawResponse.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJsonText);

        if (Array.isArray(parsed.shortNotes)) aggregated.shortNotes.push(...parsed.shortNotes);
        if (Array.isArray(parsed.oneLiners)) aggregated.oneLiners.push(...parsed.oneLiners);
        if (Array.isArray(parsed.keyConcepts)) aggregated.keyConcepts.push(...parsed.keyConcepts);
        if (Array.isArray(parsed.importantPoints)) aggregated.importantPoints.push(...parsed.importantPoints);
        if (Array.isArray(parsed.commonConfusions)) aggregated.commonConfusions.push(...parsed.commonConfusions);
        if (Array.isArray(parsed.revisionQuestions)) aggregated.revisionQuestions.push(...parsed.revisionQuestions);

        if (Array.isArray(parsed.newMCQs)) {
          parsed.newMCQs.forEach(rawQ => {
            const validatedQ = validateStructuredMCQ(rawQ);
            if (validatedQ) aggregated.newMCQs.push(validatedQ);
          });
        }
      } catch (chunkErr) {
        console.error(`[AI Service Chunk ${idx + 1} Error] ${chunkErr.message}. Continuing with remaining content.`);
      }
    }

    const finalResult = {
      shortNotes: aggregated.shortNotes.slice(0, 8),
      oneLiners: aggregated.oneLiners.slice(0, 10),
      keyConcepts: aggregated.keyConcepts.slice(0, 5),
      importantPoints: aggregated.importantPoints.slice(0, 6),
      commonConfusions: aggregated.commonConfusions.slice(0, 4),
      newMCQs: aggregated.newMCQs.slice(0, 10),
      revisionQuestions: aggregated.revisionQuestions.slice(0, 6)
    };

    // Cache generated result
    aiCache.set(contentHash, finalResult);
    return finalResult;
  } catch (err) {
    console.error('[AI Service Error]', err.message);
    return generateFallbackStudyPack(text, subject, topic);
  }
};

/**
 * Generate Question Explanation ("WHY?")
 */
export const generateQuestionExplanation = async (questionText, options, correctAnswerIndex, userSelectedIndex) => {
  if (!genAI) {
    return {
      correctAnswer: options[correctAnswerIndex] || 'Correct Option',
      whyCorrect: `Option (${String.fromCharCode(65 + correctAnswerIndex)}) is correct according to standard competitive exam references.`,
      whySelectedWrong: userSelectedIndex >= 0 && userSelectedIndex !== correctAnswerIndex 
        ? `Option (${String.fromCharCode(65 + userSelectedIndex)}) is incorrect because it does not satisfy the primary historical or conceptual condition of the question.` 
        : 'No answer was selected.',
      importantConcept: 'Key concept tested in standard SSC/UP/Railway syllabus.',
      examTip: 'Always read historical and polity facts carefully for precise dates and articles.'
    };
  }

  try {
    const prompt = `
Question: "${questionText}"
Options: ${JSON.stringify(options)}
Correct Answer Index: ${correctAnswerIndex} (${options[correctAnswerIndex]})
User Selected Index: ${userSelectedIndex}

Provide a JSON object with:
{
  "whyCorrect": "Explanation of why ${options[correctAnswerIndex]} is correct",
  "whySelectedWrong": "Explanation of why selected option is incorrect",
  "importantConcept": "Core rule or historical fact",
  "examTip": "Short tip for Indian competitive exams"
}
Return ONLY valid JSON.
    `;
    const resText = await callGeminiWithRetry(prompt);
    const cleanText = resText.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanText);
  } catch (err) {
    return {
      correctAnswer: options[correctAnswerIndex],
      whyCorrect: `Option (${String.fromCharCode(65 + correctAnswerIndex)}) is correct.`,
      whySelectedWrong: `Selected option is incorrect.`,
      importantConcept: 'Core exam concept.',
      examTip: 'Review topic revision notes.'
    };
  }
};

/**
 * Generate Similar Practice Questions
 */
export const generateSimilarQuestions = async (questionText, subject, topic, count = 3) => {
  if (!genAI) {
    return generateFallbackSimilarQuestions(questionText, subject, topic, count);
  }

  try {
    const prompt = `
Generate ${count} similar competitive exam MCQs for Subject: "${subject}", Topic: "${topic}" based on concept: "${questionText}".
Format as JSON array of objects:
[
  {
    "question": "Question",
    "options": ["Opt A", "Opt B", "Opt C", "Opt D"],
    "correctAnswer": 0,
    "explanation": "Why correct",
    "sourceType": "AI_GENERATED"
  }
]
Return ONLY JSON.
    `;
    const resText = await callGeminiWithRetry(prompt);
    const cleanText = resText.replace(/```json/g, '').replace(/```/g, '').trim();
    const rawList = JSON.parse(cleanText);

    return (Array.isArray(rawList) ? rawList : [])
      .map(q => validateStructuredMCQ(q))
      .filter(Boolean);
  } catch (err) {
    return generateFallbackSimilarQuestions(questionText, subject, topic, count);
  }
};

/**
 * AI Study Assistant Chat
 */
export const askAIStudyAssistant = async (userPrompt, contextText = '') => {
  if (!genAI) {
    return `[AI Assistant] You asked: "${userPrompt}". Note: To enable live Gemini responses, set GEMINI_API_KEY in server/.env. Based on study context: Always focus on key articles, amendments, historical dates, and standard formulas for high scores!`;
  }

  try {
    const fullPrompt = `
You are an encouraging and expert AI Study Tutor for Indian competitive exam students (SSC, Railways, UP Police, Banking).
Context Material: ${contextText.substring(0, 3000)}
Student Query: ${userPrompt}
Provide a clear, accurate, friendly response with exam tricks and simple Hindi/English explanations.
    `;
    return await callGeminiWithRetry(fullPrompt);
  } catch (err) {
    return `Error reaching AI Assistant: ${err.message}`;
  }
};

function generateFallbackStudyPack(text, subject, topic) {
  const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 10);
  const sampleSentences = sentences.slice(0, 10);

  return {
    shortNotes: [
      `Key Topic Overview: ${topic} in ${subject}.`,
      `Core Principle: ${sampleSentences[0] || 'Essential concept for Indian competitive examinations.'}`,
      `Exam Focus Area: ${sampleSentences[1] || 'Focus on factual memory, key provisions, and chronological order.'}`,
      `Revision Rule: Practice PYQs regularly to reinforce retention of ${topic}.`
    ],
    oneLiners: sampleSentences.slice(0, 6).map(s => s.replace(/\n/g, ' ')),
    keyConcepts: [
      {
        concept: `${topic} Core Foundation`,
        explanation: sampleSentences[2] || `Fundamental concept frequently tested in SSC, Railway, and State PSC examinations.`
      }
    ],
    importantPoints: [
      `High Probability Topic: Featured in SSC CGL, UP Police, and Railway NTPC exams.`
    ],
    commonConfusions: [
      {
        factA: `Primary Rule of ${topic}`,
        factB: `Secondary / Related Exception`,
        clarification: `Do not confuse general provisions with special constitutional/scientific exceptions.`
      }
    ],
    newMCQs: [
      {
        question: `Which of the following is most accurately associated with ${topic}?`,
        options: [
          `Primary Provision of ${topic}`,
          `Secondary Unrelated Principle`,
          `Outdated Historical Theory`,
          `None of the above`
        ],
        correctAnswer: 0,
        explanation: `Option A accurately reflects the core definition discussed in the study material for ${topic}.`,
        sourceType: 'SOURCE_BASED',
        verified: false,
        status: 'PENDING_REVIEW'
      }
    ],
    revisionQuestions: [
      {
        question: `What is the primary significance of ${topic} in ${subject}?`,
        shortAnswer: `It provides the foundational framework tested in competitive examination papers.`
      }
    ]
  };
}

function generateFallbackSimilarQuestions(questionText, subject, topic, count) {
  const list = [];
  for (let i = 1; i <= count; i++) {
    list.push({
      question: `[Practice Similar ${i}] Concept related to: "${topic} - ${questionText.substring(0, 40)}..."`,
      options: [
        `Correct Concept Option A`,
        `Incorrect Option B`,
        `Incorrect Option C`,
        `Incorrect Option D`
      ],
      correctAnswer: 0,
      explanation: `Option A correctly tests the sub-concept of ${topic} under ${subject}.`,
      sourceType: 'AI_GENERATED',
      verified: false,
      status: 'PENDING_REVIEW'
    });
  }
  return list;
}
