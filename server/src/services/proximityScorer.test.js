/**
 * proximityScorer.test.js
 *
 * Unit tests for all scoring functions using Node.js built-in test runner.
 * Run with:  node --experimental-vm-modules src/services/proximityScorer.test.js
 * Or add to package.json:  "test": "node --test src/services/proximityScorer.test.js"
 */
import { strict as assert } from 'assert';
import { test, describe } from 'node:test';

import {
  scoreDate,
  scoreNumeric,
  scoreText,
  scoreShortAnswer,
  parseDate,
  extractNumber,
} from './proximityScorer.js';

// ─── Helper ──────────────────────────────────────────────────────────────────
function approx(actual, expected, tolerance = 1) {
  const diff = Math.abs(actual - expected);
  assert.ok(
    diff <= tolerance,
    `Expected ${actual} to be within ${tolerance} of ${expected}`
  );
}

// ─── parseDate ───────────────────────────────────────────────────────────────
describe('parseDate', () => {
  test('parses "September 5"', () => {
    const d = parseDate('September 5');
    assert.equal(d.getMonth(), 8);   // 0-indexed → September
    assert.equal(d.getDate(), 5);
  });

  test('parses "5 September"', () => {
    const d = parseDate('5 September');
    assert.equal(d.getMonth(), 8);
    assert.equal(d.getDate(), 5);
  });

  test('parses "Sep 5"', () => {
    const d = parseDate('Sep 5');
    assert.equal(d.getMonth(), 8);
    assert.equal(d.getDate(), 5);
  });

  test('parses "15 August 1947"', () => {
    const d = parseDate('15 August 1947');
    assert.equal(d.getFullYear(), 1947);
    assert.equal(d.getMonth(), 7);   // August
    assert.equal(d.getDate(), 15);
  });

  test('parses ISO "2024-09-05"', () => {
    const d = parseDate('2024-09-05');
    assert.equal(d.getFullYear(), 2024);
    assert.equal(d.getMonth(), 8);
    assert.equal(d.getDate(), 5);
  });

  test('returns null for garbage', () => {
    assert.equal(parseDate('banana'), null);
    assert.equal(parseDate(''), null);
    assert.equal(parseDate(null), null);
  });
});

// ─── extractNumber ────────────────────────────────────────────────────────────
describe('extractNumber', () => {
  test('plain integer', () => assert.equal(extractNumber('28'), 28));
  test('with comma', () => assert.equal(extractNumber('1,947'), 1947));
  test('decimal', () => assert.equal(extractNumber('3.14'), 3.14));
  test('negative', () => assert.equal(extractNumber('-5'), -5));
  test('number with units "28 km"', () => assert.equal(extractNumber('28 km'), 28));
  test('null on text', () => assert.equal(extractNumber('abc'), null));
  test('null on empty', () => assert.equal(extractNumber(''), null));
});

// ─── scoreDate ────────────────────────────────────────────────────────────────
describe('scoreDate — reference: September 5', () => {
  test('exact match → 100', () => {
    assert.equal(scoreDate('September 5', 'September 5'), 100);
  });

  test('1 day early (Sep 4) → 97', () => {
    // d=1: 100 - 3 - 0.2 = 96.8 → 97
    assert.equal(scoreDate('September 4', 'September 5'), 97);
  });

  test('1 day late (Sep 6) → 97', () => {
    assert.equal(scoreDate('September 6', 'September 5'), 97);
  });

  test('5 days late (Sep 10) → 80', () => {
    // d=5: 100 - 15 - 5 = 80
    assert.equal(scoreDate('September 10', 'September 5'), 80);
  });

  test('10 days late (Sep 15) → 50', () => {
    // d=10: 100 - 30 - 20 = 50
    assert.equal(scoreDate('September 15', 'September 5'), 50);
  });

  test('64 days away (July 3) → 0', () => {
    // d=64: 100 - 192 - 819.2 → negative → 0
    assert.equal(scoreDate('July 3', 'September 5'), 0);
  });

  test('abbreviation "Sep 5" matches "September 5" → 100', () => {
    assert.equal(scoreDate('Sep 5', 'September 5'), 100);
  });

  test('case-insensitive "september 5" → 100', () => {
    assert.equal(scoreDate('september 5', 'September 5'), 100);
  });

  test('unparseable student answer → 0', () => {
    assert.equal(scoreDate('I dunno', 'September 5'), 0);
  });
});

// ─── scoreNumeric ─────────────────────────────────────────────────────────────
describe('scoreNumeric — reference: 28', () => {
  test('exact (28) → 100', () => {
    assert.equal(scoreNumeric('28', '28'), 100);
  });

  test('off by 1 (27) → 96', () => {
    // 100 * 27/28 = 96.43 → 96
    approx(scoreNumeric('27', '28'), 96);
  });

  test('off by 2 (26) → 93', () => {
    // 100 * 26/28 = 92.86 → 93
    approx(scoreNumeric('26', '28'), 93);
  });

  test('off by 4 (24) → 86', () => {
    // 100 * 24/28 = 85.71 → 86
    approx(scoreNumeric('24', '28'), 86);
  });

  test('off by 8 (20) → 71', () => {
    // 100 * 20/28 = 71.43 → 71
    approx(scoreNumeric('20', '28'), 71);
  });

  test('far off (0) → 0', () => {
    assert.equal(scoreNumeric('0', '28'), 0);
  });

  test('zero reference, zero student → 100', () => {
    assert.equal(scoreNumeric('0', '0'), 100);
  });

  test('zero reference, non-zero student → 0', () => {
    assert.equal(scoreNumeric('5', '0'), 0);
  });

  test('handles decimal reference "3.14"', () => {
    assert.equal(scoreNumeric('3.14', '3.14'), 100);
  });

  test('student answer with unit "28 km" → 100', () => {
    assert.equal(scoreNumeric('28 km', '28'), 100);
  });

  test('non-numeric student → 0', () => {
    assert.equal(scoreNumeric('twenty eight', '28'), 0);
  });
});

// ─── scoreText ────────────────────────────────────────────────────────────────
describe('scoreText', () => {
  test('exact match → 100', () => {
    assert.equal(scoreText('Chandragupta Maurya', 'Chandragupta Maurya'), 100);
  });

  test('case insensitive → 100', () => {
    assert.equal(scoreText('chandragupta maurya', 'Chandragupta Maurya'), 100);
  });

  test('trailing punctuation normalised → 100', () => {
    assert.equal(scoreText('Chandragupta Maurya.', 'Chandragupta Maurya'), 100);
  });

  test('wrong answer → 0', () => {
    assert.equal(scoreText('Ashoka', 'Chandragupta Maurya'), 0);
  });

  test('empty student → 0', () => {
    assert.equal(scoreText('', 'Chandragupta Maurya'), 0);
  });
});

// ─── scoreShortAnswer (auto-detect) ──────────────────────────────────────────
describe('scoreShortAnswer — type detection', () => {
  test('detects DATE type from reference "September 5"', () => {
    const r = scoreShortAnswer('September 5', 'September 5');
    assert.equal(r.type, 'date');
    assert.equal(r.score, 100);
  });

  test('detects YEAR type from reference "1947"', () => {
    const r = scoreShortAnswer('1947', '1947');
    assert.equal(r.type, 'year');
    assert.equal(r.score, 100);
  });

  test('year off by 1 → high score', () => {
    const r = scoreShortAnswer('1946', '1947');
    assert.equal(r.type, 'year');
    // 100 * (1 - 1/1947) ≈ 99.95 → 100
    approx(r.score, 100, 1);
  });

  test('year off by 10 → slightly lower', () => {
    const r = scoreShortAnswer('1937', '1947');
    assert.equal(r.type, 'year');
    // 100 * (1 - 10/1947) ≈ 99.49 → 99
    approx(r.score, 99, 1);
  });

  test('detects NUMERIC type from reference "28"', () => {
    const r = scoreShortAnswer('27', '28');
    assert.equal(r.type, 'numeric');
    approx(r.score, 96);
  });

  test('detects TEXT type for person name', () => {
    const r = scoreShortAnswer('Chandragupta Maurya', 'Chandragupta Maurya');
    assert.equal(r.type, 'text');
    assert.equal(r.score, 100);
  });

  test('empty student answer → score 0', () => {
    const r = scoreShortAnswer('', 'September 5');
    assert.equal(r.score, 0);
  });

  test('null inputs → score 0', () => {
    const r = scoreShortAnswer(null, null);
    assert.equal(r.score, 0);
  });
});
