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
 * Execute Gemini model request with exponential backoff & rate-limit handling
 */
export const executeGeminiPrompt = async (prompt, modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash', timeoutMs = 30000, maxRetries = 2) => {
  const aiClient = getGenAIClient();
  if (!aiClient) {
    throw new Error('GEMINI_API_KEY environment variable missing or unconfigured on server.');
  }

  const candidateModels = Array.from(new Set([modelName, 'gemini-2.0-flash', 'gemini-1.5-flash']));
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
          console.warn(`[Gemini Provider Warning] Model ${targetModel} returned unavailable/404. Trying fallback model...`);
          break;
        }
        const isRateLimit = err.message.includes('429') || err.message.includes('Quota') || err.message.includes('rate limit');
        if (attempt <= maxRetries) {
          const backoffMs = isRateLimit ? attempt * 3000 : attempt * 1000;
          console.warn(`[Gemini Provider Warning] Model ${targetModel} attempt ${attempt} failed (${err.message}). Retrying in ${backoffMs}ms...`);
          await new Promise(res => setTimeout(res, backoffMs));
        } else {
          if (isRateLimit) {
            throw new Error('Gemini quota/rate limit reached. Please retry later.');
          }
        }
      }
    }
  }

  throw lastError || new Error('All Gemini model fallbacks failed.');
};
