/**
 * Regression tests for bulk-mcq parser fixes (commit after cf70b98).
 *
 * Tests cover:
 *  FIX-1: Language auto-detection (Hindi, English, Bilingual)
 *  FIX-2: Within-batch duplicate detection
 *  FIX-3: questionType field value
 *  FIX-4: Option parsing with no space after delimiter (A.Text)
 *
 * Uses Node.js built-in test runner (node --test).
 * Does NOT require a live MongoDB connection — only the pure parser logic is tested.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// ─── Inline copies of the pure functions from questionRoutes.js ──────────────
// (Copied here so tests run without Express/Mongoose bootstrap)

function detectLanguage(text) {
  const hasHindi = /[\u0900-\u097F]/.test(text);
  const hasLatin = /[A-Za-z]/.test(text);
  if (hasHindi && hasLatin) return 'bilingual';
  if (hasHindi) return 'hi';
  return 'en';
}

const OPTION_REGEX = /^([A-Da-d])\s*[.)]\s*([\s\S]+)/i;
const OPTION_LINE_TEST = /^[A-Da-d]\s*[.)]\s*/i;

function parseMCQBatch(text) {
  const valid = [];
  const invalid = [];
  const seenInBatch = new Set();

  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    const qMatch = line.match(/^Q\s*(\d+)\s*[:.][\s]*([\s\S]*)?/i);
    if (!qMatch) { i++; continue; }

    const qNum = parseInt(qMatch[1], 10);
    let questionText = (qMatch[2] || '').trim();
    i++;

    while (i < lines.length) {
      const next = lines[i].trim();
      if (OPTION_LINE_TEST.test(next)) break;
      if (/^Q\s*\d+\s*[:.]/i.test(next)) break;
      if (/^(Answer|Ans|Correct\s*Answer)\s*:/i.test(next)) break;
      questionText += (next ? ' ' + next : '');
      i++;
    }
    questionText = questionText.trim();

    const options = [];
    while (i < lines.length && options.length < 4) {
      const next = lines[i].trim();
      const optMatch = next.match(OPTION_REGEX);
      if (!optMatch) break;
      options.push(optMatch[2].trim());
      i++;
    }

    let correctLetter = '';
    while (i < lines.length) {
      const next = lines[i].trim();
      if (/^(Answer|Ans|Correct\s*Answer)\s*:/i.test(next)) {
        const aMatch = next.match(/^(?:Answer|Ans|Correct\s*Answer)\s*:\s*([A-Da-d])/i);
        if (aMatch) correctLetter = aMatch[1].toUpperCase();
        i++;
        break;
      }
      if (/^Q\s*\d+\s*[:.]/i.test(next) || OPTION_LINE_TEST.test(next)) break;
      i++;
    }

    let explanation = '';
    if (i < lines.length && /^Explanation\s*:/i.test(lines[i].trim())) {
      const expMatch = lines[i].trim().match(/^Explanation\s*:\s*(.*)/i);
      explanation = (expMatch?.[1] || '').trim();
      i++;
      while (i < lines.length) {
        const el = lines[i].trim();
        if (/^Q\s*\d+\s*[:.]/i.test(el)) break;
        if (el === '') { i++; break; }
        explanation += ' ' + el;
        i++;
      }
      explanation = explanation.trim();
    }

    while (i < lines.length && lines[i].trim() === '') i++;

    if (!questionText) {
      invalid.push({ questionNumber: qNum, reason: 'Question text is empty.' });
      continue;
    }
    if (options.length !== 4) {
      invalid.push({ questionNumber: qNum, reason: `Expected 4 options (A/B/C/D), found ${options.length}.` });
      continue;
    }
    if (!correctLetter || !['A', 'B', 'C', 'D'].includes(correctLetter)) {
      invalid.push({ questionNumber: qNum, reason: 'Missing or invalid answer (expected Ans: A/B/C/D).' });
      continue;
    }

    const normalizedQ = questionText.toLowerCase().replace(/\s+/g, ' ').trim();
    if (seenInBatch.has(normalizedQ)) {
      invalid.push({ questionNumber: qNum, reason: 'Duplicate question detected within this batch — skipped.' });
      continue;
    }
    seenInBatch.add(normalizedQ);

    const correctIndex = correctLetter.charCodeAt(0) - 65;
    const combinedText = questionText + ' ' + options.join(' ');
    const language = detectLanguage(combinedText);

    valid.push({ questionText, options, correctIndex, questionType: 'mcq', language, explanation });
  }

  return { valid, invalid };
}

// ─── FIX-1: Language auto-detection ─────────────────────────────────────────

describe('FIX-1: Language auto-detection', () => {
  test('pure English text → language = en', () => {
    assert.equal(detectLanguage('What is the capital of India?'), 'en');
  });

  test('pure Hindi Devanagari text → language = hi', () => {
    assert.equal(detectLanguage('भारत की राजधानी क्या है?'), 'hi');
  });

  test('mixed Hindi and English text → language = bilingual', () => {
    assert.equal(detectLanguage('भारत की capital कौन सी है?'), 'bilingual');
  });

  test('English MCQ question stores language = en', () => {
    const text = `Q1: What is the capital of India?
A. Mumbai
B. New Delhi
C. Kolkata
D. Chennai
Answer: B`;
    const { valid } = parseMCQBatch(text);
    assert.equal(valid.length, 1);
    assert.equal(valid[0].language, 'en');
  });

  test('Hindi MCQ question stores language = hi', () => {
    const text = `Q1: भारत की राजधानी क्या है?
A. मुंबई
B. नई दिल्ली
C. कोलकाता
D. चेन्नई
Answer: B`;
    const { valid } = parseMCQBatch(text);
    assert.equal(valid.length, 1);
    assert.equal(valid[0].language, 'hi');
  });

  test('Hindi question with English options → language = bilingual', () => {
    const text = `Q1: भारत की राजधानी क्या है?
A. Mumbai
B. New Delhi
C. Kolkata
D. Chennai
Answer: B`;
    const { valid } = parseMCQBatch(text);
    assert.equal(valid.length, 1);
    assert.equal(valid[0].language, 'bilingual');
  });
});

// ─── FIX-2: Within-batch duplicate detection ─────────────────────────────────

describe('FIX-2: Within-batch duplicate detection', () => {
  test('identical question appearing twice → second is marked invalid', () => {
    const text = `Q1: What is the capital of India?
A. Mumbai
B. New Delhi
C. Kolkata
D. Chennai
Answer: B

Q2: What is the capital of India?
A. Mumbai
B. New Delhi
C. Kolkata
D. Chennai
Answer: B`;
    const { valid, invalid } = parseMCQBatch(text);
    assert.equal(valid.length, 1);
    assert.equal(invalid.length, 1);
    assert.match(invalid[0].reason, /Duplicate/i);
  });

  test('case-insensitive duplicate is caught', () => {
    const text = `Q1: What is the capital of India?
A. Mumbai
B. New Delhi
C. Kolkata
D. Chennai
Answer: B

Q2: WHAT IS THE CAPITAL OF INDIA?
A. Mumbai
B. New Delhi
C. Kolkata
D. Chennai
Answer: B`;
    const { valid, invalid } = parseMCQBatch(text);
    assert.equal(valid.length, 1);
    assert.equal(invalid.length, 1);
    assert.match(invalid[0].reason, /Duplicate/i);
  });

  test('whitespace-normalized duplicate is caught', () => {
    const text = `Q1: What   is the capital?
A. A
B. B
C. C
D. D
Answer: A

Q2: What is   the capital?
A. A
B. B
C. C
D. D
Answer: A`;
    const { valid, invalid } = parseMCQBatch(text);
    assert.equal(valid.length, 1);
    assert.equal(invalid.length, 1);
  });

  test('distinct questions are all saved — no false positives', () => {
    const text = `Q1: What is the capital of India?
A. Mumbai
B. New Delhi
C. Kolkata
D. Chennai
Answer: B

Q2: Who was the first PM of India?
A. Nehru
B. Patel
C. Gandhi
D. Shastri
Answer: A`;
    const { valid, invalid } = parseMCQBatch(text);
    assert.equal(valid.length, 2);
    assert.equal(invalid.length, 0);
  });
});

// ─── FIX-3: questionType stored as 'mcq' ────────────────────────────────────

describe('FIX-3: questionType field', () => {
  test('valid MCQ question has questionType = mcq', () => {
    const text = `Q1: What is the capital of India?
A. Mumbai
B. New Delhi
C. Kolkata
D. Chennai
Answer: B`;
    const { valid } = parseMCQBatch(text);
    assert.equal(valid.length, 1);
    assert.equal(valid[0].questionType, 'mcq');
  });

  test('questionType is mcq for all questions in a bulk batch', () => {
    const text = `Q1: Question one?
A. A
B. B
C. C
D. D
Answer: A

Q2: Question two?
A. A
B. B
C. C
D. D
Answer: B`;
    const { valid } = parseMCQBatch(text);
    assert.equal(valid.length, 2);
    assert.ok(valid.every(q => q.questionType === 'mcq'), 'All questions should have questionType=mcq');
  });
});

// ─── FIX-4: Option parsing — space optional after delimiter ──────────────────

describe('FIX-4: Option parsing with no space after delimiter', () => {
  test('A.Text (no space) is parsed correctly', () => {
    const text = `Q1: What is the capital of India?
A.Mumbai
B.New Delhi
C.Kolkata
D.Chennai
Answer: B`;
    const { valid, invalid } = parseMCQBatch(text);
    assert.equal(valid.length, 1, `Expected 1 valid, got ${valid.length}. Invalid: ${JSON.stringify(invalid)}`);
    assert.equal(valid[0].options[0], 'Mumbai');
    assert.equal(valid[0].options[1], 'New Delhi');
    assert.equal(valid[0].correctIndex, 1);
  });

  test('A) Text (parenthesis with space) is parsed correctly', () => {
    const text = `Q1: What is the capital of India?
A) Mumbai
B) New Delhi
C) Kolkata
D) Chennai
Answer: B`;
    const { valid } = parseMCQBatch(text);
    assert.equal(valid.length, 1);
    assert.equal(valid[0].options[0], 'Mumbai');
  });

  test('A)Text (parenthesis no space) is parsed correctly', () => {
    const text = `Q1: What is the capital of India?
A)Mumbai
B)New Delhi
C)Kolkata
D)Chennai
Answer: B`;
    const { valid, invalid } = parseMCQBatch(text);
    assert.equal(valid.length, 1, `Expected 1 valid, got ${valid.length}. Invalid: ${JSON.stringify(invalid)}`);
    assert.equal(valid[0].options[1], 'New Delhi');
  });

  test('mixed spacing per option (some with space, some without) all parsed', () => {
    const text = `Q1: Capital question?
A.Mumbai
B. New Delhi
C.Kolkata
D. Chennai
Answer: C`;
    const { valid, invalid } = parseMCQBatch(text);
    assert.equal(valid.length, 1, `Expected 1 valid, got ${valid.length}. Invalid: ${JSON.stringify(invalid)}`);
    assert.equal(valid[0].options.length, 4);
    assert.equal(valid[0].correctIndex, 2); // C
  });

  test('standard "A. Text" format still works (no regression)', () => {
    const text = `Q1: What is the capital of India?
A. Mumbai
B. New Delhi
C. Kolkata
D. Chennai
Answer: D`;
    const { valid } = parseMCQBatch(text);
    assert.equal(valid.length, 1);
    assert.equal(valid[0].options[3], 'Chennai');
    assert.equal(valid[0].correctIndex, 3);
  });
});

// ─── Regression: existing valid cases still pass ─────────────────────────────

describe('Regression: existing behaviour preserved', () => {
  test('Ans: format still accepted', () => {
    const text = `Q1: Capital?
A. Mumbai
B. Delhi
C. Kolkata
D. Chennai
Ans: B`;
    const { valid } = parseMCQBatch(text);
    assert.equal(valid.length, 1);
    assert.equal(valid[0].correctIndex, 1);
  });

  test('Correct Answer: format still accepted', () => {
    const text = `Q1: Capital?
A. Mumbai
B. Delhi
C. Kolkata
D. Chennai
Correct Answer: C`;
    const { valid } = parseMCQBatch(text);
    assert.equal(valid.length, 1);
    assert.equal(valid[0].correctIndex, 2);
  });

  test('question missing answer is invalid', () => {
    const text = `Q1: Capital?
A. Mumbai
B. Delhi
C. Kolkata
D. Chennai`;
    const { valid, invalid } = parseMCQBatch(text);
    assert.equal(valid.length, 0);
    assert.equal(invalid.length, 1);
    assert.match(invalid[0].reason, /Missing or invalid answer/i);
  });

  test('question with only 3 options is invalid', () => {
    const text = `Q1: Capital?
A. Mumbai
B. Delhi
C. Kolkata
Answer: A`;
    const { valid, invalid } = parseMCQBatch(text);
    assert.equal(valid.length, 0);
    assert.equal(invalid.length, 1);
    assert.match(invalid[0].reason, /Expected 4 options/i);
  });

  test('explanation is parsed and stored', () => {
    const text = `Q1: Capital?
A. Mumbai
B. New Delhi
C. Kolkata
D. Chennai
Answer: B
Explanation: New Delhi is the capital.`;
    const { valid } = parseMCQBatch(text);
    assert.equal(valid.length, 1);
    assert.equal(valid[0].explanation, 'New Delhi is the capital.');
  });

  test('50 questions all valid — no hardcoded limit', () => {
    const lines = [];
    for (let n = 1; n <= 50; n++) {
      lines.push(`Q${n}: Question number ${n}?`);
      lines.push('A. Option one');
      lines.push('B. Option two');
      lines.push('C. Option three');
      lines.push('D. Option four');
      lines.push('Answer: A');
      lines.push('');
    }
    const { valid, invalid } = parseMCQBatch(lines.join('\n'));
    assert.equal(valid.length, 50, `Expected 50, got ${valid.length}. Invalid: ${JSON.stringify(invalid)}`);
    assert.equal(invalid.length, 0);
  });
});
