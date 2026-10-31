import { GoogleGenerativeAI } from '@google/generative-ai';

let genAI = null;

const getGenAIClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim().length === 0 || apiKey === 'your_gemini_api_key_here') {
    return null;
  }
  if (!genAI) {
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
};

/**
 * Execute Gemini model request with exponential backoff & rate-limit handling.
 *
 * Model fallback order:
 *   1. Configured model (GEMINI_MODEL env var, default gemini-2.0-flash)
 *   2. gemini-2.0-flash  (fast, widely available)
 *   3. gemini-1.5-flash  (reliable fallback)
 *   4. gemini-1.5-flash-8b (smallest / most available on free tier)
 */
export const executeGeminiPrompt = async (prompt, modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash', timeoutMs = 30000, maxRetries = 2) => {
  const aiClient = getGenAIClient();
  if (!aiClient) {
    throw new Error('GEMINI_API_KEY environment variable missing or unconfigured on server.');
  }

  // Deduplicate while preserving fallback order
  const candidateModels = Array.from(
    new Set([modelName, 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-flash-8b'])
  );
  let lastError = null;

  for (const targetModel of candidateModels) {
    const model = aiClient.getGenerativeModel({ model: targetModel });

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Gemini API request timed out after 30 seconds.')), timeoutMs)
        );

        const apiPromise = model.generateContent(prompt);
        const result = await Promise.race([apiPromise, timeoutPromise]);
        return result.response.text();
      } catch (err) {
        lastError = err;
        const isNotFound = err.message.includes('404') || err.message.includes('not found') || err.message.includes('is no longer available');
        if (isNotFound) {
          console.warn(`[Gemini] Model "${targetModel}" not found/unavailable. Trying next fallback...`);
          break; // move to next candidate model
        }
        const isAuthError = err.message.includes('401') || err.message.includes('403') || err.message.includes('API_KEY');
        if (isAuthError) {
          // Hard stop — all models share the same key
          throw new Error(`Gemini authentication error (${targetModel}): ${err.message.substring(0, 200)}`);
        }
        const isRateLimit = err.message.includes('429') || err.message.includes('Quota') || err.message.includes('rate limit');
        if (attempt <= maxRetries) {
          const backoffMs = isRateLimit ? attempt * 3000 : attempt * 1000;
          console.warn(`[Gemini] Model "${targetModel}" attempt ${attempt}/${maxRetries + 1} failed: ${err.message.substring(0, 120)}. Retrying in ${backoffMs}ms...`);
          await new Promise(res => setTimeout(res, backoffMs));
        } else {
          if (isRateLimit) {
            throw new Error('Gemini quota/rate limit reached. Please retry later.');
          }
          console.warn(`[Gemini] Model "${targetModel}" exhausted all ${maxRetries + 1} attempts. Trying next fallback...`);
        }
      }
    }
  }

  throw lastError || new Error('All Gemini model fallbacks failed.');
};
