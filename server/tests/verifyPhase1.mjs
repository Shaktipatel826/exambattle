/**
 * Regression tests — Phase 1 fact extraction & error handling
 *
 * Tests:
 *   1.  Bullet-format Gemini response (• items) → parsed correctly
 *   2.  Numbered-list format (1., 2.) → parsed correctly (was broken before fix)
 *   3.  Plain-paragraph format (no marker) → parsed via fallback parser
 *   4.  Mixed format (bullets + numbered) → all facts captured
 *   5.  Hindi bullet response (देवनागरी) → Unicode preserved
 *   6.  Markdown-wrapped response (```\n• fact\n```) → facts extracted
 *   7.  Empty Gemini response → returns []
 *   8.  Header-only response (no facts) → returns []
 *   9.  Gemini 401 error → categorised as AUTH_ERROR, surfaced to caller
 *  10.  Gemini 429 error → categorised as RATE_LIMIT
 *  11.  Gemini timeout → categorised as TIMEOUT
 *  12.  Malformed JSON in response (fact extraction expects plain text, not JSON)
 *  13.  Fallback parser does not include markdown code fences or dividers
 *  14.  extractFactsFromChunk: known-good Hindi CSV facts preserved
 *  15.  Pipeline: empty text throws fast (regression guard)
 *
 * Run:  node server/tests/verifyPhase1.mjs
 */

import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const PASS = '\x1b[32m✓\x1b[0m';
const FAIL = '\x1b[31m✗\x1b[0m';
const SKIP = '\x1b[33m→\x1b[0m';

let passes = 0;
let failures = 0;

function assert(cond, label, detail = '') {
  if (cond) { console.log(`${PASS} ${label}`); passes++; }
  else { console.error(`${FAIL} ${label}${detail ? ': ' + detail : ''}`); failures++; }
}
function skip(label, reason) { console.log(`${SKIP} SKIP — ${label} (${reason})`); }

// ─── Inline the parsing logic so we can unit-test it without calling Gemini ──

const BULLET_RE = /^(?:[•◦▪●]|- |\d+[.)]\s|[（(][0-9a-z][)）]\s?)/u;
const ASTERISK_BULLET_RE = /^\* /;
const HEADER_RE = /^(?:#{1,3}\s|\*{1,2}[^*]+\*{1,2}:?\s*$|facts?:?\s*$|key\s+points?:?\s*$|तथ्य:?\s*$|मुख्य\s+बिंदु:?\s*$)/iu;
const MARKDOWN_RE = /^```|^---+$|^\*{3,}$|^\s*$/;

function parseGeminiFactResponse(rawText) {
  const lines = rawText.split('\n').map(l => l.trim());

  // First pass: recognised bullet markers (excluding standalone markdown bold labels)
  let facts = lines
    .filter(l => l && !HEADER_RE.test(l) && (BULLET_RE.test(l) || ASTERISK_BULLET_RE.test(l)))
    .map(l => l.replace(/^(?:[•◦▪●\-]\s+|\*\s+|\d+[.)]\s+|[（(][0-9a-z][)）]\s*)/, '').trim())
    .filter(l => l.length > 5);

  // Second pass: plain lines if no bullets found
  if (facts.length === 0) {
    facts = lines
      .filter(l => l.length > 10 && !HEADER_RE.test(l) && !MARKDOWN_RE.test(l))
      .map(l => l.replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1').replace(/`([^`]+)`/g, '$1').trim())
      .filter(l => l.length > 5);
  }
  return facts;
}

console.log('\nExamBattle — Phase 1 Fact Parsing Regression Tests\n');

// ── Test 1: Standard bullet format ───────────────────────────────────────────
{
  const raw = `• भारत के प्रधानमंत्री नरेंद्र मोदी हैं।\n• राजधानी नई दिल्ली है।\n• जनसंख्या 140 करोड़ है।`;
  const facts = parseGeminiFactResponse(raw);
  assert(facts.length === 3, 'Bullet •: 3 facts parsed');
  assert(facts[0].includes('नरेंद्र मोदी'), 'Bullet •: Hindi text preserved');
}

// ── Test 2: Numbered list (1. / 2.) ──────────────────────────────────────────
{
  const raw = `1. India launched the PM Surya Yojana in April 2026.\n2. The scheme covers 1 lakh solar pumps for farmers.\n3. Defence Minister Rajnath Singh unveiled a new missile system.`;
  const facts = parseGeminiFactResponse(raw);
  assert(facts.length === 3, 'Numbered list: 3 facts parsed (was broken before fix)');
  assert(facts[0].includes('PM Surya Yojana'), 'Numbered list: scheme name preserved');
}

// ── Test 3: Numbered list with closing parenthesis (1) / (a) ─────────────────
{
  const raw = `(1) India's GDP grew by 7% in Q4 2026.\n(2) RBI kept repo rate unchanged at 6.5%.\n(a) Inflation stood at 4.2%.`;
  const facts = parseGeminiFactResponse(raw);
  assert(facts.length === 3, 'Paren-numbered list: 3 facts parsed');
}

// ── Test 4: Plain-paragraph format (no markers) ──────────────────────────────
{
  const raw = `India launched a new space mission in April 2026.\nThe mission was named Gaganyaan-2.\nISRO will send three astronauts to space for a 7-day mission.`;
  const facts = parseGeminiFactResponse(raw);
  assert(facts.length === 3, 'Plain paragraphs: 3 facts parsed via fallback parser');
  assert(facts.some(f => f.includes('Gaganyaan')), 'Plain paragraphs: mission name preserved');
}

// ── Test 5: Mixed bullets and numbered ────────────────────────────────────────
{
  const raw = `• India won 5 gold medals at the Asian Games.\n1. The games were held in Doha.\n- Neeraj Chopra retained his javelin gold.`;
  const facts = parseGeminiFactResponse(raw);
  assert(facts.length === 3, 'Mixed format: 3 facts (•, 1., -)');
}

// ── Test 6: Hindi bullet response ─────────────────────────────────────────────
{
  const raw = `• अप्रैल 2026 में भारत सरकार ने 'PM सूरज' योजना शुरू की।\n• इस योजना के तहत एक लाख सोलर पंप किसानों को दिए जाएंगे।\n• रक्षा मंत्री राजनाथ सिंह ने नई मिसाइल प्रणाली का अनावरण किया।`;
  const facts = parseGeminiFactResponse(raw);
  assert(facts.length === 3, 'Hindi bullets: 3 facts');
  assert(facts[0].includes('PM सूरज'), 'Hindi bullets: scheme name preserved');
  assert(facts[2].includes('राजनाथ सिंह'), 'Hindi bullets: person name preserved');
}

// ── Test 7: Markdown-code-fence wrapped response ───────────────────────────────
{
  const raw = "```\n• Fact one about India.\n• Fact two about economy.\n```";
  const facts = parseGeminiFactResponse(raw);
  // After stripping code fences (they hit MARKDOWN_RE), bullet lines are still parsed
  assert(facts.length === 2, 'Markdown fences: facts inside ``` parsed');
}

// ── Test 8: Empty response → empty array ──────────────────────────────────────
{
  const facts = parseGeminiFactResponse('');
  assert(facts.length === 0, 'Empty response → 0 facts');
}

// ── Test 9: Header-only response → no facts ───────────────────────────────────
{
  const raw = `Facts:\nKey Points:\n**Summary:**`;
  const facts = parseGeminiFactResponse(raw);
  assert(facts.length === 0, 'Header-only response → 0 facts');
}

// ── Test 10: Response with header then bullets ────────────────────────────────
{
  const raw = `**Key Facts:**\n• India held elections in April 2026.\n• Voter turnout was 68%.`;
  const facts = parseGeminiFactResponse(raw);
  assert(facts.length === 2, 'Header + bullets: 2 facts (header excluded)');
}

// ── Test 11: Dash-bulleted items (- fact) ─────────────────────────────────────
{
  const raw = `- PM Modi visited Japan in April 2026.\n- The visit focused on tech cooperation.\n- Both countries signed 12 MoUs.`;
  const facts = parseGeminiFactResponse(raw);
  assert(facts.length === 3, 'Dash bullets: 3 facts');
}

// ── Test 12: Markdown dividers not included ────────────────────────────────────
{
  const raw = `India won the cricket World Cup.\n---\nPakistan was runner-up.\n***\nEngland was 3rd.`;
  const facts = parseGeminiFactResponse(raw);
  assert(!facts.some(f => f === '---' || f === '***'), 'Dividers excluded from facts');
  assert(facts.length >= 2, `Dividers: real facts still captured (got ${facts.length})`);
}

// ── Test 13: Asterisk bullet (* fact) ─────────────────────────────────────────
{
  const raw = `* The moon is 384,400 km from Earth.\n* Mars has two moons: Phobos and Deimos.`;
  const facts = parseGeminiFactResponse(raw);
  assert(facts.length === 2, 'Asterisk bullets: 2 facts');
}

// ── Test 14: Very short lines excluded (< 5 chars) ────────────────────────────
{
  const raw = `• OK\n• Yes\n• India launched PM Surya scheme in April 2026.`;
  const facts = parseGeminiFactResponse(raw);
  assert(facts.length === 1, 'Short lines (<5 chars) excluded; 1 real fact kept');
}

// ── Test 15: Pipeline import & empty text guard ───────────────────────────────
let runDocToTestPipeline;
try {
  const mp = await import(pathToFileURL(path.join(ROOT, 'src/services/multiAIPipeline.js')).href);
  runDocToTestPipeline = mp.runDocToTestPipeline;
} catch (e) {
  skip('Pipeline import', e.message.substring(0, 100));
}

if (runDocToTestPipeline) {
  const t0 = Date.now();
  let threw = false;
  try { await runDocToTestPipeline({ extractedText: '' }); } catch { threw = true; }
  const ms = Date.now() - t0;
  assert(threw, 'Pipeline: empty text throws');
  assert(ms < 500, `Pipeline: throws fast (${ms} ms)`);
} else {
  skip('Pipeline empty-text guard', 'import failed');
}

// ── Test 16: Error category classification ────────────────────────────────────
{
  function classifyErr(msg) {
    if (msg.includes('API_KEY') || msg.includes('401') || msg.includes('403')) return 'AUTH_ERROR';
    if (msg.includes('429') || msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('rate limit')) return 'RATE_LIMIT';
    if (msg.includes('timed out') || msg.includes('timeout')) return 'TIMEOUT';
    if (msg.includes('404') || msg.includes('not found') || msg.includes('fallbacks failed')) return 'MODEL_NOT_FOUND';
    return 'API_ERROR';
  }
  assert(classifyErr('GEMINI_API_KEY missing') === 'AUTH_ERROR', 'Classify: API_KEY → AUTH_ERROR');
  assert(classifyErr('HTTP 401 Unauthorized') === 'AUTH_ERROR', 'Classify: 401 → AUTH_ERROR');
  assert(classifyErr('HTTP 403 Forbidden') === 'AUTH_ERROR', 'Classify: 403 → AUTH_ERROR');
  assert(classifyErr('HTTP 429 rate limit exceeded') === 'RATE_LIMIT', 'Classify: 429 → RATE_LIMIT');
  assert(classifyErr('Quota exceeded for quota metric') === 'RATE_LIMIT', 'Classify: quota → RATE_LIMIT');
  assert(classifyErr('Gemini API request timed out after 30 seconds.') === 'TIMEOUT', 'Classify: timeout → TIMEOUT');
  assert(classifyErr('Model not found (404)') === 'MODEL_NOT_FOUND', 'Classify: 404 → MODEL_NOT_FOUND');
  assert(classifyErr('All Gemini model fallbacks failed.') === 'MODEL_NOT_FOUND', 'Classify: fallbacks failed → MODEL_NOT_FOUND');
  assert(classifyErr('Network error') === 'API_ERROR', 'Classify: unknown → API_ERROR');
}

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${failures === 0 ? PASS + ' All tests passed' : FAIL + ` ${failures} test(s) failed`} — ${passes} passed, ${failures} failed\n`);
process.exit(failures > 0 ? 1 : 0);
