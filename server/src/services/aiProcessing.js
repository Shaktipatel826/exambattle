import { generateStudyPackWithAI, generateSimilarQuestions } from './gemini.js';

/**
 * Modular AI Question Generation Layer.
 * Prepares extracted text from Supabase Storage and generates structured MCQs + Notes
 * with full source tracking metadata.
 */
export const processDocumentWithAI = async ({
  extractedText,
  subject = 'General Studies',
  topic = 'General',
  exam = 'General',
  sourceDocumentName = 'Document',
  uploadedBy = 'Admin'
}) => {
  if (!extractedText || extractedText.trim().length === 0) {
    throw new Error('No extracted text available for AI processing.');
  }

  // 1. Delegate to AI Study Pack Generator
  const studyPackOutput = await generateStudyPackWithAI(extractedText, subject, topic);

  // 2. Format MCQs with full metadata schema & PENDING_REVIEW approval status
  const formattedMCQs = (studyPackOutput.newMCQs || []).map((q, idx) => ({
    question: q.question,
    options: q.options,
    correctAnswer: q.correctAnswer,
    explanation: q.explanation || `Derived from study document: ${sourceDocumentName}`,
    subject,
    topic,
    exam,
    difficulty: q.difficulty || 'Medium',
    source: `Document: ${sourceDocumentName}`,
    sourceType: q.sourceType || 'SOURCE_BASED',
    sourceReference: `${sourceDocumentName} (Item #${idx + 1})`,
    verified: false,
    status: 'PENDING_REVIEW', // MUST go to Admin Review Queue before publication
    createdBy: uploadedBy
  }));

  return {
    notes: studyPackOutput.shortNotes || [],
    oneLiners: studyPackOutput.oneLiners || [],
    keyConcepts: studyPackOutput.keyConcepts || [],
    importantPoints: studyPackOutput.importantPoints || [],
    commonConfusions: studyPackOutput.commonConfusions || [],
    generatedMCQs: formattedMCQs,
    revisionQuestions: studyPackOutput.revisionQuestions || []
  };
};
