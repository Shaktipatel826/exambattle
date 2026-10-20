/**
 * Groq Distractor Generator Service
 *
 * Responsibility: Given a question text, the correct answer, and optional source context,
 * generate exactly 3 plausible-but-incorrect distractor options.
 *
 * The final options array is: [correct, distractor1, distractor2, distractor3] shuffled.
 * The returned correctAnswer is the NEW index after shuffle — never hardcoded 0.
 *
 * Environment variables used (never hardcoded):
 *   GROQ_API_KEY   — required
 *   GROQ_MODEL     — optional, defaults to llama-3.3-70b-versatile
 */

import Groq from 'groq-sdk';

let groqClient = null;

function getGroqClient() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey.trim() === '' || apiKey === 'your_groq_api_key_here') {
    return null;
  }
  if (!groqClient) {
    groqClient = new Groq({ apiKey });
  }
  return groqClient;
}

const GROQ_MODEL = () => process.env.GROQ_MODEL || 'qwen/qwen3.8-27b';
// Fallback models tried in order if primary fails
const GROQ_FALLBACK_MODELS = ['qwen/qwen3.8-27b', 'openai/gpt-oss-20b', 'allam-2-7b'];
const GROQ_TIMEOUT_MS = 20000;
const GROQ_MAX_RETRIES = 2;

/**
 * Shuffle an array (Fisher-Yates) and return [shuffledArray, newIndexOf(originalItem)]
 */
function shuffleWithTracking(arr, trackedValue) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return { shuffled: copy, newIndex: copy.indexOf(trackedValue) };
}

/**
 * Generate 3 distractor options for a given question + correct answer.
 *
 * Returns:
 *   {
 *     options: string[4],          // shuffled array with all 4 options
 *     correctAnswer: number,       // index of correct answer in the returned options array
 *     distractors: string[3],      // just the 3 distractors (for debugging / audit)
 *     provider: 'groq'
 *   }
 *
 * Throws if Groq is unconfigured or if valid distractors cannot be generated after retries.
 */
export const generateDistractors = async (question, correctAnswer, sourceContext = '', subject = '') => {
  const client = getGroqClient();

  if (!client) {
    throw new Error(
      'GROQ_API_KEY is not configured. Add it to server/.env as GROQ_API_KEY=your_key'
    );
  }

  const prompt = `You are a competitive exam MCQ distractor generator specializing in Indian exams (SSC, Railway, UP Police, Banking).

Question: "${question}"
Correct Answer: "${correctAnswer}"
Subject: "${subject || 'General Studies'}"
${sourceContext ? `Source Context (reference only): ${sourceContext.substring(0, 800)}` : ''}

Task: Generate exactly 3 WRONG but PLAUSIBLE distractor options for this question.
Rules:
1. All 3 distractors must be INCORRECT — never match the correct answer.
2. Distractors must be RELEVANT to the question topic and similar in style/length to the correct answer.
3. Each distractor must be DISTINCT from each other and from the correct answer.
4. Do NOT include option labels (A, B, C, 1, 2, 3).
5. If 3 valid distractors cannot be generated, return an error field explaining why.

Respond with ONLY valid JSON:
{
  "distractors": ["wrong option 1", "wrong option 2", "wrong option 3"],
  "error": null
}

If you cannot generate valid distractors, respond:
{
  "distractors": [],
  "error": "reason why distractors could not be generated"
}`;

  let lastError = null;

  // Try each model in fallback order; within each model retry on transient failures
  const modelList = Array.from(new Set([GROQ_MODEL(), ...GROQ_FALLBACK_MODELS]));

  for (const model of modelList) {
    for (let attempt = 1; attempt <= GROQ_MAX_RETRIES + 1; attempt++) {
      try {
        const completion = await Promise.race([
          client.chat.completions.create({
            model,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
            max_tokens: 400,
            response_format: { type: 'json_object' }
          }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Groq API request timed out after 20s')), GROQ_TIMEOUT_MS)
          )
        ]);

        const rawText = completion.choices?.[0]?.message?.content || '';
        let parsed;
        try {
          parsed = JSON.parse(rawText.replace(/```json/g, '').replace(/```/g, '').trim());
        } catch {
          throw new Error(`Groq returned invalid JSON: ${rawText.substring(0, 200)}`);
        }

        if (parsed.error) {
          throw new Error(`Groq distractor generation failed: ${parsed.error}`);
        }

        const distractors = (parsed.distractors || [])
          .filter(d => typeof d === 'string' && d.trim().length > 0)
          .map(d => d.trim())
          .filter(d => d.toLowerCase() !== correctAnswer.toLowerCase());

        if (distractors.length < 3) {
          throw new Error(
            `Groq returned only ${distractors.length}/3 valid distractors. Retrying...`
          );
        }

        // Shuffle: place correct answer randomly among 4 options
        const allOptions = [correctAnswer, distractors[0], distractors[1], distractors[2]];
        const { shuffled, newIndex } = shuffleWithTracking(allOptions, correctAnswer);

        return {
          options: shuffled,
          correctAnswer: newIndex,
          distractors: distractors.slice(0, 3),
          provider: 'groq'
        };
      } catch (err) {
        lastError = err;
        const isNotFound = err.message.includes('404') || err.message.includes('not found') ||
          err.message.includes('model_not_found') || err.message.includes('does not exist');
        if (isNotFound) {
          console.warn(`[Groq] Model ${model} not found. Trying fallback...`);
          break; // skip remaining attempts on this model, try next
        }
        const isRateLimit = err.message.includes('429') || err.message.includes('rate_limit') || err.message.includes('quota');
        if (attempt <= GROQ_MAX_RETRIES) {
          const backoffMs = isRateLimit ? attempt * 4000 : attempt * 1500;
          console.warn(`[Groq] Model ${model} attempt ${attempt} failed: ${err.message}. Retrying in ${backoffMs}ms...`);
          await new Promise(res => setTimeout(res, backoffMs));
        }
      }
    }
  }

  throw lastError || new Error('Groq distractor generation failed after all retries.');
};
