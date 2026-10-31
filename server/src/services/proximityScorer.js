/**
 * proximityScorer.js
 *
 * Proximity-based partial scoring for ExamBattle short-answer questions.
 *
 * Supported answer types (auto-detected from referenceAnswer):
 *   - DATE    → calendar-day proximity formula: max(0, 100 - 3d - 0.2d²)
 *   - YEAR    → treated as numeric (4-digit year 1000-2200)
 *   - NUMERIC → percentage proximity: max(0, 100 * (1 - |stu-ref| / |ref|))
 *   - TEXT    → normalised exact match: 100 or 0
 *
 * All score functions return an integer 0–100.
 */

// ─── Month table ─────────────────────────────────────────────────────────────
// Sorted longest-first so "september" matches before "sep"
const MONTH_MAP = [
  ['january',   1], ['february', 2], ['march',    3], ['april',     4],
  ['august',    8], ['october', 10], ['november', 11], ['december', 12],
  ['september', 9], ['june',     6], ['july',      7],
  ['jan', 1], ['feb', 2], ['mar', 3], ['apr', 4], ['may', 5],
  ['jun', 6], ['jul', 7], ['aug', 8], ['sep', 9], ['sept', 9],
  ['oct', 10], ['nov', 11], ['dec', 12],
];

// ─── Date parsing ────────────────────────────────────────────────────────────

/**
 * Parse a date string into a JS Date (year normalised to 2000 if not given).
 * Supports "September 5", "5 Sep", "15 August 1947", "YYYY-MM-DD".
 * Returns null if unparseable.
 */
export function parseDate(str) {
  if (!str || typeof str !== 'string') return null;
  const s = str.trim().toLowerCase();

  // ISO: YYYY-MM-DD
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    return new Date(+iso[1], +iso[2] - 1, +iso[3]);
  }

  // Find month name
  let month = null;
  let rest = s;
  for (const [name, num] of MONTH_MAP) {
    if (s.includes(name)) {
      month = num;
      rest = s.replace(name, ' ').replace(/[,.\-/]/g, ' ');
      break;
    }
  }

  if (month !== null) {
    const nums = (rest.match(/\d+/g) || []).map(Number);
    let day = null;
    let year = null;
    for (const n of nums) {
      if (n >= 1 && n <= 31 && day === null) day = n;
      else if (n >= 1000 && n <= 2200) year = n;
    }
    if (day !== null) {
      return new Date(year ?? 2000, month - 1, day);
    }
  }

  // Last resort: try native Date
  const native = new Date(str);
  if (!isNaN(native.getTime())) return native;

  return null;
}

/**
 * Returns true if the string contains a recognisable date pattern.
 */
export function isDateString(str) {
  if (!str || typeof str !== 'string') return false;
  const s = str.toLowerCase();
  if (/\d{4}-\d{1,2}-\d{1,2}/.test(s)) return true;
  return MONTH_MAP.some(([name]) => s.includes(name));
}

// ─── Number extraction ────────────────────────────────────────────────────────

/**
 * Strip commas, units and trailing symbols, then parse the leading number.
 * Returns a float or null.
 */
export function extractNumber(str) {
  if (!str || typeof str !== 'string') return null;
  // Remove commas used as thousands separators
  const cleaned = str.replace(/,/g, '').trim();
  // Match leading numeric token (handles negatives, decimals, sci notation)
  const m = cleaned.match(/^-?[\d]+(?:\.[\d]+)?(?:[eE][+-]?[\d]+)?/);
  if (!m) return null;
  const n = parseFloat(m[0]);
  return isNaN(n) ? null : n;
}

/**
 * Returns true if the string is a 4-digit year (1000–2200).
 */
function isYearStr(str) {
  if (!str) return false;
  const t = str.trim();
  if (!/^\d{4}$/.test(t)) return false;
  const y = parseInt(t, 10);
  return y >= 1000 && y <= 2200;
}

// ─── Scoring functions ────────────────────────────────────────────────────────

/**
 * Date proximity score.
 * d  = |calendar days between student date and reference date|
 * score = max(0, 100 − 3d − 0.2d²)  → integer 0–100
 */
export function scoreDate(studentStr, referenceStr) {
  const ref = parseDate(referenceStr);
  const stu = parseDate(studentStr);
  if (!ref || !stu) return 0;

  const diffMs = Math.abs(stu.getTime() - ref.getTime());
  const d = Math.round(diffMs / 86_400_000); // ms per day
  return Math.max(0, Math.round(100 - 3 * d - 0.2 * d * d));
}

/**
 * Numeric proximity score.
 * score = max(0, 100 × (1 − |stu−ref| / |ref|))  → integer 0–100
 * Zero reference: returns 100 iff student also answers 0.
 */
export function scoreNumeric(studentStr, referenceStr) {
  const ref = extractNumber(referenceStr);
  const stu = extractNumber(studentStr);
  if (ref === null || stu === null) return 0;
  if (ref === 0) return stu === 0 ? 100 : 0;
  const ratio = 1 - Math.abs(stu - ref) / Math.abs(ref);
  return Math.max(0, Math.round(100 * ratio));
}

/**
 * Text exact-match score (case-insensitive, punctuation-normalised).
 * Returns 100 for a match, 0 otherwise.
 */
export function scoreText(studentStr, referenceStr) {
  const norm = (s) =>
    (s || '')
      .toLowerCase()
      .replace(/[.,/#!$%^&*;:{}=\-_`~()'"\u2018\u2019\u201c\u201d]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  return norm(studentStr) === norm(referenceStr) ? 100 : 0;
}

/**
 * Auto-detect answer type and return a scored result.
 *
 * @param {string} studentStr   – what the student typed
 * @param {string} referenceStr – the stored reference answer
 * @returns {{ score: number, type: 'date'|'year'|'numeric'|'text' }}
 */
export function scoreShortAnswer(studentStr, referenceStr) {
  if (!studentStr || !referenceStr) return { score: 0, type: 'text' };

  // DATE (has a month name or ISO date)
  if (isDateString(referenceStr)) {
    return { score: scoreDate(studentStr, referenceStr), type: 'date' };
  }

  // YEAR (bare 4-digit year)
  if (isYearStr(referenceStr.trim())) {
    const refN = parseInt(referenceStr.trim(), 10);
    const stuN = extractNumber(studentStr);
    if (stuN !== null) {
      return { score: scoreNumeric(String(Math.round(stuN)), String(refN)), type: 'year' };
    }
    return { score: 0, type: 'year' };
  }

  // NUMERIC
  const refNum = extractNumber(referenceStr);
  if (refNum !== null) {
    return { score: scoreNumeric(studentStr, referenceStr), type: 'numeric' };
  }

  // TEXT
  return { score: scoreText(studentStr, referenceStr), type: 'text' };
}
