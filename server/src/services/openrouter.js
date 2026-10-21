/**
 * OpenRouter Independent MCQ Verifier Service
 *
 * Responsibility: Given a fully-assembled MCQ (question, 4 options, correctAnswer index, explanation),
 * independently verify whether the stated correct answer is actually correct.
 * Returns a structured PASS/FAIL verdict with optional correction.
 *
 * Environment variables used (never hardcoded):
 *   OPENROUTER_API_KEY  — required
 *   OPENROUTER_MODEL    — optional, defaults to meta-llama/llama-3-8b-instruct
 *   OPENROUTER_SITE_URL — optional, for HTTP-Referer header
 *   OPENROUTER_SITE_NAME — optional, for X-Title header
 */

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const VERIFY_TIMEOUT_MS = 12000; // 12 s per attempt — was 25 s
const VERIFY_MAX_RETRIES = 1;   // 2 total attempts — was 3

function getOpenRouterHeaders() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey || apiKey.trim() === '' || apiKey === 'your_openrouter_api_key_here') {
    return null;
  }
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
    'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'https://exambattle-app.onrender.com',
    'X-Title': process.env.OPENROUTER_SITE_NAME || 'ExamBattle AI'
  };
}

function getOpenRouterModel() {
  return process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.1-8b-instruct';
}

// Fallback model tried if the primary model is unavailable / rate-limited
const OPENROUTER_FALLBACK_MODEL = 'google/gemma-3-4b-it:free';

/**
 * Verify a fully assembled MCQ.
 *
 * @param {object} mcq
 *   mcq.question      {string}
 *   mcq.options       {string[4]}
 *   mcq.correctAnswer {number}  0-indexed
 *   mcq.explanation   {string}  optional context
 *   mcq.subject       {string}  optional
 *
 * Returns:
 * {
 *   verdict: 'PASS' | 'FAIL',
 *   confidence: 'HIGH' | 'MEDIUM' | 'LOW',
 *   correctAnswerIndex: number,       // same as input on PASS, or corrected index on FAIL
 *   correctAnswerText: string,
 *   reasoning: string,
 *   provider: 'openrouter',
 *   model: string
 * }
 */
export const verifyMCQ = async (mcq) => {
  const headers = getOpenRouterHeaders();

  if (!headers) {
    throw new Error(
      'OPENROUTER_API_KEY is not configured. Add it to server/.env as OPENROUTER_API_KEY=your_key'
    );
  }

  const { question, options, correctAnswer, explanation = '', subject = 'General Studies' } = mcq;

  if (!question || !Array.isArray(options) || options.length !== 4) {
    throw new Error('verifyMCQ requires question and exactly 4 options.');
  }

  const optionLines = options.map((opt, i) => `${String.fromCharCode(65 + i)}) ${opt}`).join('\n');
  const claimedCorrect = options[correctAnswer];

  const prompt = `You are an independent fact-checker for Indian competitive exam MCQs (SSC, Railway, Banking, UP Police).

Subject: ${subject}
Question: "${question}"

Options:
${optionLines}

The system claims the correct answer is: Option ${String.fromCharCode(65 + correctAnswer)}) "${claimedCorrect}"
Additional context/explanation: "${explanation}"

Your task:
1. Independently determine the factually correct answer to this question.
2. Determine if the claimed answer is CORRECT or INCORRECT.
3. If INCORRECT, identify which option (A/B/C/D) is actually correct.

Respond with ONLY valid JSON:
{
  "verdict": "PASS" or "FAIL",
  "confidence": "HIGH" or "MEDIUM" or "LOW",
  "actualCorrectOption": "A" or "B" or "C" or "D",
  "reasoning": "brief 1-2 sentence explanation"
}`;

  const model = getOpenRouterModel();
  const modelsToTry = [model, OPENROUTER_FALLBACK_MODEL].filter(Boolean);
  let lastError = null;

  for (const currentModel of modelsToTry) {
    for (let attempt = 1; attempt <= VERIFY_MAX_RETRIES + 1; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);

        let response;
        try {
          response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
            method: 'POST',
            headers,
            signal: controller.signal,
            body: JSON.stringify({
              model: currentModel,
              messages: [{ role: 'user', content: prompt }],
              temperature: 0.1,
              max_tokens: 300
            })
          });
        } finally {
          clearTimeout(timeoutId);
        }

        if (!response.ok) {
          const errBody = await response.text();
          throw new Error(`OpenRouter HTTP ${response.status}: ${errBody.substring(0, 200)}`);
        }

        const data = await response.json();
        const rawText = data.choices?.[0]?.message?.content || '';

        let parsed;
        try {
          parsed = JSON.parse(rawText.replace(/```json/g, '').replace(/```/g, '').trim());
        } catch {
          throw new Error(`OpenRouter returned invalid JSON: ${rawText.substring(0, 200)}`);
        }

        const actualOptionLetter = (parsed.actualCorrectOption || 'A').toUpperCase().trim();
        const actualIndex = actualOptionLetter.charCodeAt(0) - 65;
        const clampedIndex = Math.min(Math.max(actualIndex, 0), 3);

        return {
          verdict: parsed.verdict === 'PASS' ? 'PASS' : 'FAIL',
          confidence: ['HIGH', 'MEDIUM', 'LOW'].includes(parsed.confidence) ? parsed.confidence : 'MEDIUM',
          correctAnswerIndex: clampedIndex,
          correctAnswerText: options[clampedIndex] || options[0],
          reasoning: parsed.reasoning || 'No reasoning provided.',
          provider: 'openrouter',
          model: currentModel
        };
      } catch (err) {
        lastError = err;
        const isRateLimit = err.message.includes('429') || err.message.includes('rate_limit') || err.message.includes('quota');
        const isUnavailable = err.message.includes('503') || err.message.includes('502') || err.message.includes('unavailable');
        if (attempt <= VERIFY_MAX_RETRIES) {
          const backoffMs = isRateLimit ? attempt * 5000 : attempt * 2000;
          console.warn(`[OpenRouter] Model=${currentModel} attempt ${attempt} failed: ${err.message}. Retrying in ${backoffMs}ms...`);
          await new Promise(res => setTimeout(res, backoffMs));
        } else if (isUnavailable || isRateLimit) {
          // Exhausted retries for this model — break inner loop and try fallback
          console.warn(`[OpenRouter] Switching to fallback model after exhausting retries for ${currentModel}`);
        }
      }
    }
  }

  throw lastError || new Error('OpenRouter verification failed after all retries and fallback models.');
};
