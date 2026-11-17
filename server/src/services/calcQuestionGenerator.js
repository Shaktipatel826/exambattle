/**
 * calcQuestionGenerator.js
 *
 * Server-side question generator for Calculation Arena.
 * All questions generated algorithmically — no DB queries.
 * Each question: { id, text, answer, category, difficulty }
 * answer is always a Number (int or float).
 */

// ─── Utilities ────────────────────────────────────────────────────────────────
const rnd = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a; }
function lcm(a, b) { return (a / gcd(a, b)) * b; }

// ─── Generators ───────────────────────────────────────────────────────────────

function genAddition(diff) {
  const ranges = { easy:[1,50], medium:[10,500], hard:[100,9999], expert:[1000,99999] };
  const [lo, hi] = ranges[diff] || ranges.medium;
  const a = rnd(lo, hi), b = rnd(lo, hi);
  return { text: `${a} + ${b} = ?`, answer: a + b };
}

function genSubtraction(diff) {
  const ranges = { easy:[1,50], medium:[10,500], hard:[100,9999], expert:[1000,99999] };
  const [lo, hi] = ranges[diff] || ranges.medium;
  let a = rnd(lo, hi), b = rnd(lo, hi);
  if (b > a) [a, b] = [b, a];
  return { text: `${a} - ${b} = ?`, answer: a - b };
}

function genMultiplication(diff) {
  const cfg = { easy:[[2,9],[2,12]], medium:[[10,50],[2,20]], hard:[[12,99],[12,50]], expert:[[50,999],[50,200]] };
  const [r1, r2] = cfg[diff] || cfg.medium;
  const a = rnd(r1[0], r1[1]), b = rnd(r2[0], r2[1]);
  return { text: `${a} x ${b} = ?`, answer: a * b };
}

function genDivision(diff) {
  const ranges = { easy:[2,10], medium:[2,25], hard:[5,50], expert:[10,100] };
  const [lo, hi] = ranges[diff] || ranges.medium;
  const divisor = rnd(lo, hi);
  const quotient = rnd(2, diff === 'expert' ? 500 : diff === 'hard' ? 200 : 50);
  return { text: `${divisor * quotient} / ${divisor} = ?`, answer: quotient };
}

function genLCM(diff) {
  const cfg = {
    easy:   [[2,20],[2,20]],
    medium: [[5,50],[5,50]],
    hard:   [[10,100],[10,100],[10,100]],
    expert: [[10,200],[10,200],[10,200]],
  };
  const ranges = cfg[diff] || cfg.medium;
  const nums = ranges.map(([lo,hi]) => rnd(lo,hi));
  const result = nums.reduce(lcm, nums[0]);
  return { text: `LCM of ${nums.join(', ')} = ?`, answer: result };
}

function genHCF(diff) {
  const cfg = {
    easy:   [[2,30],[2,30]],
    medium: [[5,100],[5,100]],
    hard:   [[10,200],[10,200],[10,200]],
    expert: [[20,500],[20,500],[20,500]],
  };
  const ranges = cfg[diff] || cfg.medium;
  const nums = ranges.map(([lo,hi]) => rnd(lo,hi));
  const result = nums.reduce(gcd, nums[0]);
  return { text: `HCF of ${nums.join(', ')} = ?`, answer: result };
}

function genSquare(diff) {
  const ranges = { easy:[2,15], medium:[10,30], hard:[25,75], expert:[50,150] };
  const [lo, hi] = ranges[diff] || ranges.medium;
  const n = rnd(lo, hi);
  return { text: `${n}^2 = ?`, answer: n * n };
}

function genCube(diff) {
  const ranges = { easy:[2,8], medium:[5,15], hard:[10,25], expert:[15,40] };
  const [lo, hi] = ranges[diff] || ranges.medium;
  const n = rnd(lo, hi);
  return { text: `${n}^3 = ?`, answer: n * n * n };
}

function genSqRoot(diff) {
  const max = { easy:12, medium:20, hard:35, expert:50 };
  const n = rnd(2, max[diff] || 20);
  return { text: `sqrt(${n * n}) = ?`, answer: n };
}

function genCbRoot(diff) {
  const max = { easy:5, medium:8, hard:12, expert:20 };
  const n = rnd(2, max[diff] || 8);
  return { text: `cbrt(${n*n*n}) = ?`, answer: n };
}

const TRIG_BASIC = [
  { text:'sin(0) = ?',  answer:0 },
  { text:'sin(30) = ?', answer:0.5 },
  { text:'sin(45) = ?', answer:0.7071 },
  { text:'sin(60) = ?', answer:0.8660 },
  { text:'sin(90) = ?', answer:1 },
  { text:'cos(0) = ?',  answer:1 },
  { text:'cos(30) = ?', answer:0.8660 },
  { text:'cos(45) = ?', answer:0.7071 },
  { text:'cos(60) = ?', answer:0.5 },
  { text:'cos(90) = ?', answer:0 },
  { text:'tan(0) = ?',  answer:0 },
  { text:'tan(30) = ?', answer:0.5774 },
  { text:'tan(45) = ?', answer:1 },
  { text:'tan(60) = ?', answer:1.7321 },
];

const TRIG_HARD = [
  { text:'sin^2(30) + cos^2(30) = ?', answer:1 },
  { text:'sin^2(45) + cos^2(45) = ?', answer:1 },
  { text:'sin^2(60) + cos^2(60) = ?', answer:1 },
  { text:'2 x sin(30) x cos(30) = ?', answer:0.8660 },
  { text:'tan(45) + sin(90) = ?', answer:2 },
  { text:'sin(0) + cos(0) = ?', answer:1 },
  { text:'sin(90) + cos(90) = ?', answer:1 },
  { text:'sin^2(30) = ?', answer:0.25 },
  { text:'cos^2(60) = ?', answer:0.25 },
  { text:'tan^2(45) = ?', answer:1 },
  { text:'2 x sin(60) x cos(60) = ?', answer:0.8660 },
  { text:'sin(30) x cos(60) + cos(30) x sin(60) = ?', answer:1 },
];

function genTrig(diff) {
  if (diff === 'easy' || diff === 'medium') return pick(TRIG_BASIC);
  return pick(TRIG_HARD);
}

const LOG_EASY = [
  { text:'log10(1) = ?',    answer:0 },
  { text:'log10(10) = ?',   answer:1 },
  { text:'log10(100) = ?',  answer:2 },
  { text:'log10(1000) = ?', answer:3 },
  { text:'log2(2) = ?',     answer:1 },
  { text:'log2(4) = ?',     answer:2 },
  { text:'log2(8) = ?',     answer:3 },
  { text:'log2(16) = ?',    answer:4 },
  { text:'log2(32) = ?',    answer:5 },
  { text:'log3(3) = ?',     answer:1 },
  { text:'log3(9) = ?',     answer:2 },
  { text:'log3(27) = ?',    answer:3 },
  { text:'log5(5) = ?',     answer:1 },
  { text:'log5(25) = ?',    answer:2 },
  { text:'log5(125) = ?',   answer:3 },
  { text:'log10(10000) = ?',answer:4 },
];

const LOG_HARD = [
  { text:'log10(2) + log10(50) = ?', answer:2 },
  { text:'log10(4) + log10(25) = ?', answer:2 },
  { text:'log10(8) + log10(125) = ?',answer:3 },
  { text:'log10(1000) - log10(10) = ?',answer:2 },
  { text:'log10(100) - log10(10) = ?', answer:1 },
  { text:'2 x log10(10) = ?', answer:2 },
  { text:'3 x log10(10) = ?', answer:3 },
  { text:'log10(5) + log10(20) = ?', answer:2 },
];

function genLog(diff) {
  if (diff === 'easy' || diff === 'medium') return pick(LOG_EASY);
  return pick(LOG_HARD);
}

function genNumberSystem(diff) {
  if (diff === 'easy') {
    // Divisibility: answer 1=Yes 0=No (always generate divisible for simplicity)
    const d = pick([2,3,4,5,6,8,9,10]);
    const q = rnd(2, 50);
    return { text: `${d * q} divisible by ${d}? (1=Yes, 0=No) = ?`, answer: 1 };
  }
  if (diff === 'medium') {
    // Unit digit of power
    const a = rnd(2, 20), b = rnd(2, 10);
    return { text: `Unit digit of ${a}^${b} = ?`, answer: (a ** b) % 10 };
  }
  if (diff === 'hard') {
    const divisor = pick([7, 8, 9, 11, 13]);
    const q = rnd(10, 100), r = rnd(0, divisor - 1);
    return { text: `${divisor * q + r} mod ${divisor} = ?`, answer: r };
  }
  // expert: sum of factors
  const n = rnd(10, 50);
  let s = 0; for (let i = 1; i <= n; i++) if (n % i === 0) s += i;
  return { text: `Sum of factors of ${n} = ?`, answer: s };
}

function genArithmetic(diff) {
  const type = pick(['percentage', 'average', 'bodmas', 'ratio']);
  if (type === 'percentage') {
    const pcts = { easy:[10,20,25,50], medium:[5,10,15,20,25,30,40,50], hard:[1,99], expert:[1,99] };
    const pct = diff === 'easy' ? pick(pcts.easy)
              : diff === 'medium' ? pick(pcts.medium)
              : rnd(1, 99);
    const base = diff === 'easy' ? pick([40,60,80,100,120,200])
               : diff === 'medium' ? rnd(10,50)*10
               : rnd(50,500);
    const ans = parseFloat(((pct * base) / 100).toFixed(2));
    return { text: `${pct}% of ${base} = ?`, answer: ans };
  }
  if (type === 'average') {
    const count = diff === 'easy' ? rnd(2,4) : rnd(3,6);
    const nums = Array.from({length:count}, () => rnd(10,99));
    const avg = parseFloat((nums.reduce((a,b)=>a+b,0)/count).toFixed(2));
    return { text: `Average of ${nums.join(', ')} = ?`, answer: avg };
  }
  if (type === 'bodmas') {
    const a = rnd(1,10), b = rnd(1,10), c = rnd(1,10), d = rnd(1,10);
    return { text: `${a} + ${b} x ${c} - ${d} = ?`, answer: a + b*c - d };
  }
  // ratio
  const a = rnd(2,10), b = rnd(2,10), total = rnd(50,300);
  const shareA = Math.round((a/(a+b))*total);
  return { text: `Ratio ${a}:${b}. Total = ${total}. First share = ?`, answer: shareA };
}

function genMixed(diff) {
  if (diff === 'easy' || diff === 'medium') {
    const a = rnd(5,30), b = rnd(5,30), c = rnd(2,12);
    return { text: `(${a} + ${b}) x ${c} = ?`, answer: (a+b)*c };
  }
  if (diff === 'hard') {
    const a = rnd(10,50), b = rnd(2,10), c = rnd(5,20), d = rnd(2,8);
    return { text: `(${a} - ${b}) x ${c} + ${d} = ?`, answer: (a-b)*c+d };
  }
  // expert
  const pct = pick([10,20,25,50]);
  const base = rnd(100,1000);
  const extra = rnd(10,100);
  return { text: `${pct}% of ${base} + ${extra} = ?`, answer: (pct*base)/100+extra };
}

// ─── Public API ───────────────────────────────────────────────────────────────

const GENERATORS = {
  addition:       genAddition,
  subtraction:    genSubtraction,
  multiplication: genMultiplication,
  division:       genDivision,
  lcm:            genLCM,
  hcf:            genHCF,
  squares:        genSquare,
  cubes:          genCube,
  square_root:    genSqRoot,
  cube_root:      genCbRoot,
  trigonometry:   genTrig,
  logarithm:      genLog,
  number_system:  genNumberSystem,
  arithmetic:     genArithmetic,
  mixed:          genMixed,
};

export const ALL_CATEGORIES = Object.keys(GENERATORS);

export const CATEGORY_LABELS = {
  addition:       'Addition',
  subtraction:    'Subtraction',
  multiplication: 'Multiplication',
  division:       'Division',
  lcm:            'LCM',
  hcf:            'HCF',
  squares:        'Squares',
  cubes:          'Cubes',
  square_root:    'Square Root',
  cube_root:      'Cube Root',
  trigonometry:   'Trigonometry',
  logarithm:      'Logarithm',
  number_system:  'Number System',
  arithmetic:     'Arithmetic',
  mixed:          'Mixed',
};

/**
 * Generate a single question.
 * @param {string[]} categories
 * @param {string} difficulty
 * @param {number} id
 */
export function generateQuestion(categories, difficulty, id = 0) {
  const diff = difficulty || 'medium';
  const validCats = (categories || []).filter(c => GENERATORS[c]);
  const cat = pick(validCats.length ? validCats : ALL_CATEGORIES);
  let result;
  try { result = GENERATORS[cat](diff); }
  catch (e) { result = genAddition(diff); }
  return { id, text: result.text, answer: result.answer, category: cat, difficulty: diff };
}

/**
 * Pre-generate a batch of questions (deduped by text).
 * @param {string[]} categories
 * @param {string} difficulty
 * @param {number} count
 */
export function generateQuestionBatch(categories, difficulty, count = 200) {
  const questions = [];
  const seen = new Set();
  let attempts = 0;
  while (questions.length < count && attempts < count * 6) {
    attempts++;
    const q = generateQuestion(categories, difficulty, questions.length);
    if (!seen.has(q.text)) {
      seen.add(q.text);
      questions.push(q);
    }
  }
  return questions;
}

/**
 * Validate a submitted answer.
 * Tolerates 0.001 float epsilon for decimal answers.
 * @param {string|number} submitted
 * @param {number} expected
 * @returns {{ correct: boolean, expected: number }}
 */
export function validateAnswer(submitted, expected) {
  if (submitted === null || submitted === undefined || submitted === '') {
    return { correct: false, expected };
  }
  const sub = parseFloat(String(submitted).trim());
  if (isNaN(sub)) return { correct: false, expected };
  if (Number.isInteger(expected)) return { correct: sub === expected, expected };
  return { correct: Math.abs(sub - expected) < 0.001, expected };
}
