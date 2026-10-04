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

export const buildMcqPrompt = (textChunk, subject, topic, exam = 'General', difficulty = 'Medium', count = 10) => {
  return `
You are a senior exam paper setter for Indian competitive exams (${exam}).
Extract as many distinct, source-grounded, exam-relevant Multiple Choice Questions (MCQs) as the provided content reasonably supports (aim for up to ${Math.max(5, count)} questions depending on content density).
Do NOT artificially limit the output to a small fixed number. Cover different facts, dates, constitutional articles, amendments, provisions, persons, events, definitions, concepts, numbers, examples, and important factual statements present in the source content.

Rules:
1. Every question MUST be strictly grounded in the provided source content. Do NOT hallucinate or invent facts outside the text.
2. Exactly 4 distinct options for each question.
3. Exactly 1 correct answer (index 0, 1, 2, or 3).
4. Explanation must explain why the correct option is right based on the source text.
5. Mix correct option indices (A, B, C, D across questions).
6. Do NOT generate study notes, summaries, or flashcards. Generate ONLY MCQs.

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
      "explanation": "Clear rationale grounded in text...",
      "subject": "${subject}",
      "topic": "${topic}",
      "difficulty": "${difficulty}",
      "source_document": "Source Material",
      "source_reference": "Section / Paragraph / Concept",
      "tags": ["${subject.toLowerCase()}", "${topic.toLowerCase()}"]
    }
  ]
}

Return ONLY valid JSON.

Source Content:
${textChunk}
  `;
};
