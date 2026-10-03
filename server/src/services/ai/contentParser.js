/**
 * Content Parser & Validator for AI Outputs
 */

export const parseCleanJSON = (rawText) => {
  if (!rawText || typeof rawText !== 'string') return null;

  try {
    const cleanText = rawText
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();
    return JSON.parse(cleanText);
  } catch (err) {
    console.warn('[AI Content Parser Warning] JSON parse error:', err.message);
    return null;
  }
};

export const validateMCQSchema = (q, defaultSubject = 'General', defaultTopic = 'General') => {
  if (!q || typeof q !== 'object') return null;
  if (!q.question || typeof q.question !== 'string' || q.question.trim().length < 5) return null;

  let optionsList = [];
  if (Array.isArray(q.options)) {
    optionsList = q.options.map(o => String(o).trim());
  } else if (q.options && typeof q.options === 'object') {
    optionsList = [q.options.A || q.options.a, q.options.B || q.options.b, q.options.C || q.options.c, q.options.D || q.options.d].filter(Boolean);
  }

  if (optionsList.length !== 4 || optionsList.some(o => o.length === 0)) return null;

  // Determine correct answer index
  let correctIdx = 0;
  if (typeof q.correct_answer === 'number') correctIdx = q.correct_answer;
  else if (typeof q.correct_answer === 'string') {
    const letter = q.correct_answer.trim().toUpperCase();
    if (letter === 'A' || letter === '0') correctIdx = 0;
    else if (letter === 'B' || letter === '1') correctIdx = 1;
    else if (letter === 'C' || letter === '2') correctIdx = 2;
    else if (letter === 'D' || letter === '3') correctIdx = 3;
  } else if (typeof q.correctAnswer === 'number') correctIdx = q.correctAnswer;

  if (correctIdx < 0 || correctIdx > 3) correctIdx = 0;

  return {
    question: q.question.trim(),
    options: optionsList,
    correctAnswer: correctIdx,
    explanation: q.explanation ? String(q.explanation).trim() : 'Verified explanation derived from study material.',
    subject: q.subject || defaultSubject,
    topic: q.topic || defaultTopic,
    difficulty: ['Easy', 'Medium', 'Hard'].includes(q.difficulty) ? q.difficulty : 'Medium',
    sourceReference: q.source_reference || q.sourceReference || 'Document Extract',
    tags: Array.isArray(q.tags) ? q.tags : [],
    status: 'PENDING_REVIEW'
  };
};

export const validateOneLinerSchema = (item, defaultTopic = 'General') => {
  if (!item) return null;
  const text = typeof item === 'string' ? item.trim() : (item.text || item.statement || '').trim();
  if (!text || text.length < 5) return null;

  return {
    text,
    topic: item.topic || defaultTopic,
    importance: ['high', 'medium', 'low'].includes(item.importance) ? item.importance : 'high',
    source_reference: item.source_reference || item.sourceReference || 'Study Material'
  };
};
