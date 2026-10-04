/**
 * Modular Prompt Builder for Gemini AI Content Generation
 */

export const buildOneLinersPrompt = (textChunk, subject, topic) => {
  return `
You are an expert tutor for competitive exams in India (SSC, Railways, Banking, UP State).
Strictly extract concise, factual, high-yield revision one-liners from the provided source material.
Do NOT invent facts outside the text.

Subject: ${subject}
Topic: ${topic}

Output MUST be a JSON object with schema:
{
  "oneLiners": [
    {
      "text": "Consequences of Revolt of 1857 ended East India Company rule.",
      "topic": "${topic}",
      "importance": "high",
      "source_reference": "Paragraph 1"
    }
  ]
}

Return ONLY valid JSON.

Source Content:
${textChunk}
  `;
};

export const buildStudyNotesPrompt = (textChunk, subject, topic) => {
  return `
You are an expert study material creator for Indian competitive exams.
Generate structured study notes strictly from the provided source material.

Subject: ${subject}
Topic: ${topic}

Output MUST be a JSON object with schema:
{
  "studyNotes": {
    "title": "${subject} - ${topic} Summary Notes",
    "overview": "Concise summary overview...",
    "sections": [
      { "title": "Key Provisions", "content": "Section details..." }
    ],
    "keyConcepts": [
      { "concept": "Concept Name", "explanation": "Detailed explanation..." }
    ],
    "importantFacts": [ "Fact 1", "Fact 2" ],
    "revisionPoints": [ "Point 1", "Point 2" ]
  }
}

Return ONLY valid JSON.

Source Content:
${textChunk}
  `;
};

export const buildMcqPrompt = (textChunk, subject, topic, exam = 'General', difficulty = 'Medium') => {
  return `
You are a senior exam paper setter for Indian competitive exams (${exam}).
Read this source material carefully and extract EVERY distinct, exam-relevant Multiple Choice Question (MCQ) that can be directly supported by the provided material.

CRITICAL INSTRUCTIONS:
1. Do NOT stop after a fixed small number (like 5, 8, or 10).
2. Do NOT return a fixed number of questions.
3. Do NOT summarize. Do NOT create study notes. Do NOT create flashcards. Do NOT create one-liners. Generate MCQs ONLY.
4. Do NOT invent facts or hallucinate information that is not supported by the source.
5. Extract as many distinct high-quality MCQs as the source material reasonably supports.
6. If the source material contains pre-existing formatted questions (e.g. Q1, Q2, Q3...), parse, preserve, and structure ALL of those questions without skipping any.
7. If the source material contains factual statements, dates, constitutional articles, amendments, provisions, events, definitions, concepts, numbers, persons, classifications, comparisons, statistics, or exam-oriented statements, generate a separate distinct MCQ for each supported fact.
8. Each question MUST have exactly 4 distinct options and exactly 1 correct answer index (0, 1, 2, or 3).
9. Mix correct answer option indices (A, B, C, D) across generated questions.
10. Continue extracting questions until ALL useful material in this source chunk has been exhausted.

Subject: ${subject}
Topic: ${topic}
Target Exam: ${exam}
Difficulty: ${difficulty}

Output MUST be a JSON object with schema:
{
  "mcqs": [
    {
      "question": "Clear exam question statement...",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_answer": 0,
      "explanation": "Clear rationale directly supported by source text...",
      "subject": "${subject}",
      "topic": "${topic}",
      "difficulty": "${difficulty}",
      "source_document": "Source Material",
      "source_reference": "Section / Paragraph / Concept",
      "tags": ["${subject.toLowerCase()}", "${topic.toLowerCase()}"]
    }
  ]
}

Return ONLY valid JSON matching this schema. No markdown outside the JSON block.

Source Content:
${textChunk}
  `;
};
