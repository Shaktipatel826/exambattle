/**
 * Unit tests for the parseQAText function (Paste Q&A mode).
 * Run: node server/src/routes/savedTestRoutes.test.mjs
 *
 * Tests:
 *  1. Hindi question + answer
 *  2. English question + answer
 *  3. Hinglish question + answer
 *  4. Numerical answer (1947)
 *  5. Multi-line question and multi-line answer
 *  6. Optional explanation present
 *  7. Missing answer → error
 *  8. Duplicate question → error
 *  9. Multiple questions in one input
 * 10. Q: separator variant (colon only)
 */

// ── Inline copy of the parser (mirrors savedTestRoutes.js) ──────────────────
function parseQAText(rawText) {
  const questions = [];
  const errors = [];
  const seenQuestions = new Set();

  const lines = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    const qMatch = line.match(/^Q\s*(\d+)\s*[:.]\s*(.+)?/i);
    if (!qMatch) { i++; continue; }

    const qNum = parseInt(qMatch[1], 10);
    let questionText = (qMatch[2] || '').trim();
    i++;

    while (i < lines.length) {
      const nextLine = lines[i].trim();
      if (/^(Answer|Ans)\s*:/i.test(nextLine)) break;
      if (/^Q\s*\d+\s*[:.]/i.test(nextLine)) break;
      if (/^Explanation\s*:/i.test(nextLine)) break;
      questionText += (nextLine ? ' ' + nextLine : '');
      i++;
    }
    questionText = questionText.trim();

    let referenceAnswer = '';
    if (i < lines.length && /^(Answer|Ans)\s*:/i.test(lines[i].trim())) {
      const ansMatch = lines[i].trim().match(/^(Answer|Ans)\s*:\s*(.*)/i);
      referenceAnswer = (ansMatch?.[2] || '').trim();
      i++;
      while (i < lines.length) {
        const al = lines[i].trim();
        if (/^(Explanation|Q\s*\d+\s*[:.:])/i.test(al)) break;
        if (/^Q\s*\d+\s*[:.]/i.test(al)) break;
        if (al === '') { i++; break; }
        referenceAnswer += ' ' + al;
        i++;
      }
      referenceAnswer = referenceAnswer.trim();
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

    const ref = `Q${qNum}`;
    if (!questionText) { errors.push({ ref, issue: 'Question text is empty.' }); continue; }
    if (!referenceAnswer) { errors.push({ ref, issue: 'Missing "Answer:" line.' }); continue; }

    const qKey = questionText.toLowerCase().replace(/\s+/g, ' ').trim();
    if (seenQuestions.has(qKey)) { errors.push({ ref, issue: 'Duplicate question.' }); continue; }
    seenQuestions.add(qKey);

    questions.push({
      question: questionText,
      referenceAnswer,
      explanation: explanation || '',
      questionType: 'short_answer',
      options: [],
      correctAnswer: null,
    });
  }

  return { questions, errors, stats: { parsed: questions.length, errored: errors.length, total: questions.length + errors.length } };
}

// ── Test runner ──────────────────────────────────────────────────────────────
let passed = 0; let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${label}`);
    failed++;
  }
}

// 1. Hindi question + answer
console.log('\n[1] Hindi Q&A');
{
  const r = parseQAText(`Q1: भारत के प्रथम राष्ट्रपति कौन थे?\nAnswer: डॉ. राजेंद्र प्रसाद`);
  assert(r.questions.length === 1, '1 question parsed');
  assert(r.questions[0].question.includes('राष्ट्रपति'), 'Hindi question text preserved');
  assert(r.questions[0].referenceAnswer === 'डॉ. राजेंद्र प्रसाद', 'Hindi answer preserved');
  assert(r.questions[0].questionType === 'short_answer', 'questionType = short_answer');
  assert(r.questions[0].options.length === 0, 'No MCQ options');
  assert(r.questions[0].correctAnswer === null, 'correctAnswer is null');
}

// 2. English question + answer
console.log('\n[2] English Q&A');
{
  const r = parseQAText(`Q1: Who founded the Maurya Empire?\nAnswer: Chandragupta Maurya`);
  assert(r.questions.length === 1, '1 question parsed');
  assert(r.questions[0].referenceAnswer === 'Chandragupta Maurya', 'English answer correct');
}

// 3. Hinglish Q&A
console.log('\n[3] Hinglish Q&A');
{
  const r = parseQAText(`Q1: Bharat ki rajdhani kya hai?\nAnswer: New Delhi`);
  assert(r.questions.length === 1, '1 question parsed');
  assert(r.questions[0].referenceAnswer === 'New Delhi', 'Hinglish answer correct');
}

// 4. Numerical answer
console.log('\n[4] Numerical answer (year)');
{
  const r = parseQAText(`Q1: भारत कब स्वतंत्र हुआ?\nAnswer: 15 अगस्त 1947`);
  assert(r.questions.length === 1, '1 question parsed');
  assert(r.questions[0].referenceAnswer === '15 अगस्त 1947', 'Numerical/date answer preserved');
}

// 5. Multi-line answer
console.log('\n[5] Multi-line answer');
{
  const r = parseQAText(`Q1: What were the causes of the 1857 revolt?\nAnswer: Greased cartridges,\nsocial reforms, annexation policy\nand economic discontent.`);
  assert(r.questions.length === 1, '1 question parsed');
  assert(r.questions[0].referenceAnswer.includes('economic discontent'), 'Multi-line answer joined');
}

// 6. Optional explanation
console.log('\n[6] Optional explanation');
{
  const r = parseQAText(`Q1: भारत कब स्वतंत्र हुआ?\nAnswer: 15 अगस्त 1947\nExplanation: भारत 15 अगस्त 1947 को ब्रिटिश शासन से स्वतंत्र हुआ।`);
  assert(r.questions.length === 1, '1 question parsed');
  assert(r.questions[0].explanation.includes('ब्रिटिश'), 'Explanation parsed');
}

// 7. Missing answer → error
console.log('\n[7] Missing answer');
{
  const r = parseQAText(`Q1: What is the capital?\n\nQ2: Who was the first PM?\nAnswer: Nehru`);
  assert(r.errors.length === 1, '1 error for missing answer');
  assert(r.errors[0].ref === 'Q1', 'Error on Q1');
  assert(r.questions.length === 1, '1 valid question (Q2) parsed');
}

// 8. Duplicate question → error
console.log('\n[8] Duplicate question');
{
  const r = parseQAText(`Q1: भारत की राजधानी क्या है?\nAnswer: नई दिल्ली\n\nQ2: भारत की राजधानी क्या है?\nAnswer: नई दिल्ली`);
  assert(r.questions.length === 1, 'Only 1 unique question');
  assert(r.errors.length === 1, '1 error for duplicate');
  assert(r.errors[0].issue.includes('Duplicate'), 'Error says duplicate');
}

// 9. Multiple valid questions
console.log('\n[9] Multiple questions');
{
  const input = `Q1: First PM of India?\nAnswer: Jawaharlal Nehru\n\nQ2: Capital of France?\nAnswer: Paris\n\nQ3: 2+2=?\nAnswer: 4`;
  const r = parseQAText(input);
  assert(r.questions.length === 3, '3 questions parsed');
  assert(r.errors.length === 0, '0 errors');
  assert(r.stats.total === 3, 'stats.total = 3');
}

// 10. Q: variant (dot separator)
console.log('\n[10] Q. separator variant');
{
  const r = parseQAText(`Q1. RBI की स्थापना कब हुई?\nAnswer: 1935`);
  assert(r.questions.length === 1, '1 question with dot separator');
  assert(r.questions[0].referenceAnswer === '1935', 'Answer correct');
}

// ── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`Tests: ${passed + failed} total — ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
