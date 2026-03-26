// ═══════════════════════════════════════════════════════════════════════════════
// ACCURACY TEST SUITE — All 23 rules, true positives + true negatives + edges
// Run: node tests/accuracy.js
// ═══════════════════════════════════════════════════════════════════════════════

import { runAnalysis } from '../src/analysis/engine.js';

// ── Test case format ──────────────────────────────────────────────────────────
// { label, code, language, expect: { fires: [...ruleIds], silent: [...ruleIds] } }
// fires  → rule MUST appear in flags
// silent → rule MUST NOT appear in flags

const cases = [

  // ─── nested-loops ───────────────────────────────────────────────────────────
  {
    label: "nested-loops / TP: classic double for",
    language: "javascript",
    expect: { fires: ["nested-loops"] },
    code: `
function findDuplicates(arr) {
  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) {
      if (arr[i] === arr[j]) return true;
    }
  }
  return false;
}`,
  },
  {
    label: "nested-loops / TN: hashmap dedup (no nesting)",
    language: "javascript",
    expect: { silent: ["nested-loops"] },
    code: `
function findDuplicates(arr) {
  const seen = new Set();
  for (const x of arr) {
    if (seen.has(x)) return true;
    seen.add(x);
  }
  return false;
}`,
  },
  {
    label: "nested-loops / EDGE: two sequential loops (should NOT trigger)",
    language: "javascript",
    expect: { silent: ["nested-loops"] },
    code: `
for (let i = 0; i < a.length; i++) {
  process(a[i]);
}
for (let j = 0; j < b.length; j++) {
  process(b[j]);
}`,
  },

  // ─── triple-nested-loops ────────────────────────────────────────────────────
  {
    label: "triple-nested-loops / TP: three nested fors",
    language: "javascript",
    expect: { fires: ["triple-nested-loops"] },
    code: `
for (let i = 0; i < n; i++) {
  for (let j = 0; j < n; j++) {
    for (let k = 0; k < n; k++) {
      result[i][j][k] = i * j * k;
    }
  }
}`,
  },
  {
    label: "triple-nested-loops / TN: only two nested fors",
    language: "javascript",
    expect: { silent: ["triple-nested-loops"] },
    code: `
for (let i = 0; i < n; i++) {
  for (let j = 0; j < n; j++) {
    result[i][j] = i * j;
  }
}`,
  },

  // ─── linear-scan-in-loop ────────────────────────────────────────────────────
  {
    label: "linear-scan-in-loop / TP: includes() inside for",
    language: "javascript",
    expect: { fires: ["linear-scan-in-loop"] },
    code: `
const result = [];
for (const item of items) {
  if (!result.includes(item)) {
    result.push(item);
  }
}`,
  },
  {
    label: "linear-scan-in-loop / TN: Set.has() inside loop",
    language: "javascript",
    expect: { silent: ["linear-scan-in-loop"] },
    code: `
const seen = new Set();
const result = [];
for (const item of items) {
  if (!seen.has(item)) {
    seen.add(item);
    result.push(item);
  }
}`,
  },
  {
    label: "linear-scan-in-loop / TN: includes() outside any loop",
    language: "javascript",
    expect: { silent: ["linear-scan-in-loop"] },
    code: `
const valid = ['a', 'b', 'c'];
function isValid(x) {
  return valid.includes(x);
}`,
  },
  {
    label: "linear-scan-in-loop / EDGE: commented-out includes() in loop (should NOT fire)",
    language: "javascript",
    expect: { silent: ["linear-scan-in-loop"] },
    code: `
for (const item of items) {
  // result.includes(item) -- old approach
  process(item);
}`,
  },

  // ─── alloc-in-loop ──────────────────────────────────────────────────────────
  {
    label: "alloc-in-loop / TP: new Object() each iteration",
    language: "javascript",
    expect: { fires: ["alloc-in-loop"] },
    code: `
for (let i = 0; i < n; i++) {
  const obj = new Object();
  obj.index = i;
  results.push(obj);
}`,
  },
  {
    label: "alloc-in-loop / TP: empty array literal in loop",
    language: "javascript",
    expect: { fires: ["alloc-in-loop"] },
    code: `
for (let i = 0; i < n; i++) {
  const temp = [];
  temp.push(data[i]);
  process(temp);
}`,
  },
  {
    label: "alloc-in-loop / TN: allocation before loop, reused inside",
    language: "javascript",
    expect: { silent: ["alloc-in-loop"] },
    code: `
const result = [];
for (let i = 0; i < n; i++) {
  result.push(i * 2);
}`,
  },

  // ─── unbounded-recursion ────────────────────────────────────────────────────
  {
    label: "unbounded-recursion / TP: naive fibonacci",
    language: "javascript",
    expect: { fires: ["unbounded-recursion"] },
    code: `
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}`,
  },
  {
    label: "unbounded-recursion / TN: memoized fibonacci",
    language: "javascript",
    expect: { silent: ["unbounded-recursion"] },
    code: `
const memo = {};
function fibonacci(n) {
  if (n <= 1) return n;
  if (memo[n]) return memo[n];
  memo[n] = fibonacci(n - 1) + fibonacci(n - 2);
  return memo[n];
}`,
  },
  {
    label: "unbounded-recursion / TN: non-recursive function",
    language: "javascript",
    expect: { silent: ["unbounded-recursion"] },
    code: `
function add(a, b) {
  return a + b;
}`,
  },

  // ─── sort-in-loop ───────────────────────────────────────────────────────────
  {
    label: "sort-in-loop / TP: .sort() inside for loop",
    language: "javascript",
    expect: { fires: ["sort-in-loop"] },
    code: `
for (let i = 0; i < rounds; i++) {
  items.sort((a, b) => a.score - b.score);
  const top = items[0];
  process(top);
}`,
  },
  {
    label: "sort-in-loop / TN: sort called once before loop",
    language: "javascript",
    expect: { silent: ["sort-in-loop"] },
    code: `
items.sort((a, b) => a.score - b.score);
for (let i = 0; i < items.length; i++) {
  process(items[i]);
}`,
  },

  // ─── async-in-loop ──────────────────────────────────────────────────────────
  {
    label: "async-in-loop / TP: await inside for loop",
    language: "javascript",
    expect: { fires: ["async-in-loop"] },
    code: `
async function fetchAll(urls) {
  const results = [];
  for (const url of urls) {
    const data = await fetch(url);
    results.push(await data.json());
  }
  return results;
}`,
  },
  {
    label: "async-in-loop / TN: Promise.all (concurrent)",
    language: "javascript",
    expect: { silent: ["async-in-loop"] },
    code: `
async function fetchAll(urls) {
  return Promise.all(urls.map(url => fetch(url).then(r => r.json())));
}`,
  },

  // ─── dom-in-loop ────────────────────────────────────────────────────────────
  {
    label: "dom-in-loop / TP: createElement inside loop",
    language: "javascript",
    expect: { fires: ["dom-in-loop"] },
    code: `
for (let i = 0; i < items.length; i++) {
  const div = document.createElement('div');
  div.innerHTML = items[i].name;
  container.appendChild(div);
}`,
  },
  {
    label: "dom-in-loop / TN: DocumentFragment batch insert",
    language: "javascript",
    expect: { silent: ["dom-in-loop"] },
    code: `
const fragment = document.createDocumentFragment();
for (let i = 0; i < items.length; i++) {
  const div = document.createElement('div');
  fragment.appendChild(div);
}
container.appendChild(fragment);`,
  },
  {
    label: "dom-in-loop / TN: DOM manipulation entirely outside loop",
    language: "javascript",
    expect: { silent: ["dom-in-loop"] },
    code: `
const data = items.map(x => x.value);
const el = document.getElementById('output');
el.innerHTML = data.join(', ');`,
  },

  // ─── array-as-set ───────────────────────────────────────────────────────────
  {
    label: "array-as-set / TP: includes() without Set anywhere",
    language: "javascript",
    expect: { fires: ["array-as-set"] },
    code: `
const allowList = ['admin', 'editor', 'viewer'];
if (allowList.includes(userRole)) {
  grantAccess();
}`,
  },
  {
    label: "array-as-set / TN: using Set.has()",
    language: "javascript",
    expect: { silent: ["array-as-set"] },
    code: `
const allowList = new Set(['admin', 'editor', 'viewer']);
if (allowList.has(userRole)) {
  grantAccess();
}`,
  },

  // ─── string-concat-loop ─────────────────────────────────────────────────────
  {
    label: "string-concat-loop / TP: += inside for loop",
    language: "javascript",
    expect: { fires: ["string-concat-loop"] },
    code: `
let html = '';
for (let i = 0; i < items.length; i++) {
  html += '<li>' + items[i] + '</li>';
}`,
  },
  {
    label: "string-concat-loop / TN: array.join approach",
    language: "javascript",
    expect: { silent: ["string-concat-loop"] },
    code: `
const parts = [];
for (let i = 0; i < items.length; i++) {
  parts.push('<li>' + items[i] + '</li>');
}
const html = parts.join('');`,
  },
  {
    label: "string-concat-loop / TN: += outside loop",
    language: "javascript",
    expect: { silent: ["string-concat-loop"] },
    code: `
let result = 'Hello';
result += ' World';
result += '!';`,
  },

  // ─── console-in-loop ────────────────────────────────────────────────────────
  {
    label: "console-in-loop / TP: console.log inside for",
    language: "javascript",
    expect: { fires: ["console-in-loop"] },
    code: `
for (let i = 0; i < n; i++) {
  console.log('Processing item', i);
  process(items[i]);
}`,
  },
  {
    label: "console-in-loop / TN: console.log outside loop",
    language: "javascript",
    expect: { silent: ["console-in-loop"] },
    code: `
for (let i = 0; i < n; i++) {
  process(items[i]);
}
console.log('Done processing', n, 'items');`,
  },
  {
    label: "console-in-loop / EDGE: commented console.log inside loop (should NOT fire)",
    language: "javascript",
    expect: { silent: ["console-in-loop"] },
    code: `
for (let i = 0; i < n; i++) {
  // console.log('debug', i);
  process(items[i]);
}`,
  },

  // ─── large-function ─────────────────────────────────────────────────────────
  {
    label: "large-function / TP: over 60 lines",
    language: "javascript",
    expect: { fires: ["large-function"] },
    code: Array(65).fill("  doSomething();").join("\n"),
  },
  {
    label: "large-function / TN: under 60 lines",
    language: "javascript",
    expect: { silent: ["large-function"] },
    code: Array(30).fill("  doSomething();").join("\n"),
  },

  // ─── python-nested-comprehension ────────────────────────────────────────────
  {
    label: "python-nested-comprehension / TP",
    language: "python",
    expect: { fires: ["python-nested-comprehension"] },
    code: `matrix = [[j for j in range(cols)] for i in range(rows)]`,
  },
  {
    label: "python-nested-comprehension / TN: flat comprehension",
    language: "python",
    expect: { silent: ["python-nested-comprehension"] },
    code: `squares = [x * x for x in range(10)]`,
  },

  // ─── python-append-loop ─────────────────────────────────────────────────────
  {
    label: "python-append-loop / TP: .append() inside for loop",
    language: "python",
    expect: { fires: ["python-append-loop"] },
    code: `
result = []
for item in items:
    result.append(item * 2)`,
  },
  {
    label: "python-append-loop / TN: list comprehension",
    language: "python",
    expect: { silent: ["python-append-loop"] },
    code: `result = [item * 2 for item in items]`,
  },
  {
    label: "python-append-loop / TN: append outside loop",
    language: "python",
    expect: { silent: ["python-append-loop"] },
    code: `
result = []
result.append(42)
result.append(99)`,
  },

  // ─── python-keys-iteration ──────────────────────────────────────────────────
  {
    label: "python-keys-iteration / TP: for x in d.keys()",
    language: "python",
    expect: { fires: ["python-keys-iteration"] },
    code: `
for key in my_dict.keys():
    print(key)`,
  },
  {
    label: "python-keys-iteration / TN: direct dict iteration",
    language: "python",
    expect: { silent: ["python-keys-iteration"] },
    code: `
for key in my_dict:
    print(key)`,
  },

  // ─── python-in-list-literal ─────────────────────────────────────────────────
  {
    label: "python-in-list-literal / TP (fires)",
    language: "python",
    expect: { fires: ["python-in-list-literal"] },
    code: `
if value in [1, 2, 3, 4, 5]:
    process(value)`,
  },
  {
    label: "python-in-list-literal / TN: tuple membership",
    language: "python",
    expect: { silent: ["python-in-list-literal"] },
    code: `
if value in (1, 2, 3, 4, 5):
    process(value)`,
  },

  // ─── empty-catch ────────────────────────────────────────────────────────────
  {
    label: "empty-catch / TP: catch(e) {}",
    language: "javascript",
    expect: { fires: ["empty-catch"] },
    code: `
try {
  riskyOperation();
} catch(e) {}`,
  },
  {
    label: "empty-catch / TP: multi-line empty catch",
    language: "javascript",
    expect: { fires: ["empty-catch"] },
    code: `
try {
  riskyOperation();
} catch (err) {
}`,
  },
  {
    label: "empty-catch / TN: catch with error logging",
    language: "javascript",
    expect: { silent: ["empty-catch"] },
    code: `
try {
  riskyOperation();
} catch (e) {
  console.error('Operation failed:', e);
}`,
  },
  {
    label: "empty-catch / TN: catch with rethrow",
    language: "javascript",
    expect: { silent: ["empty-catch"] },
    code: `
try {
  riskyOperation();
} catch (e) {
  throw new Error('Wrapped: ' + e.message);
}`,
  },

  // ─── missing-null-check ─────────────────────────────────────────────────────
  {
    label: "missing-null-check / TP: chained access without optional chaining",
    language: "javascript",
    expect: { fires: ["missing-null-check"] },
    code: `
function getName(user) {
  return user.profile.details.name;
}`,
  },
  {
    label: "missing-null-check / TN: optional chaining used",
    language: "javascript",
    expect: { silent: ["missing-null-check"] },
    code: `
function getName(user) {
  return user?.profile?.details?.name;
}`,
  },

  // ─── unhandled-promise ──────────────────────────────────────────────────────
  {
    label: "unhandled-promise / TP: fetch without try-catch or .catch()",
    language: "javascript",
    expect: { fires: ["unhandled-promise"] },
    code: `
async function loadData() {
  const res = await fetch('/api/data');
  const data = await res.json();
  return data;
}`,
  },
  {
    label: "unhandled-promise / TN: fetch inside try-catch",
    language: "javascript",
    expect: { silent: ["unhandled-promise"] },
    code: `
async function loadData() {
  try {
    const res = await fetch('/api/data');
    return await res.json();
  } catch (e) {
    console.error(e);
    return null;
  }
}`,
  },
  {
    label: "unhandled-promise / TN: promise chain with .catch()",
    language: "javascript",
    expect: { silent: ["unhandled-promise"] },
    code: `
function loadData() {
  return fetch('/api/data')
    .then(res => res.json())
    .catch(err => { console.error(err); return null; });
}`,
  },

  // ─── infinite-loop-risk ─────────────────────────────────────────────────────
  {
    label: "infinite-loop-risk / TP: while(true) with no break or return",
    language: "javascript",
    expect: { fires: ["infinite-loop-risk"] },
    code: `
function run() {
  while (true) {
    doWork();
  }
}`,
  },
  {
    label: "infinite-loop-risk / TN: while(true) with break",
    language: "javascript",
    expect: { silent: ["infinite-loop-risk"] },
    code: `
function poll() {
  while (true) {
    const result = checkStatus();
    if (result === 'done') break;
  }
}`,
  },
  {
    label: "infinite-loop-risk / TN: regular while with condition",
    language: "javascript",
    expect: { silent: ["infinite-loop-risk"] },
    code: `
let i = 0;
while (i < 10) {
  process(i);
  i++;
}`,
  },

  // ─── excessive-parameters ───────────────────────────────────────────────────
  {
    label: "excessive-parameters / TP: 6 parameters",
    language: "javascript",
    expect: { fires: ["excessive-parameters"] },
    code: `
function createUser(name, email, age, role, department, managerId) {
  return { name, email, age, role, department, managerId };
}`,
  },
  {
    label: "excessive-parameters / TN: 3 parameters",
    language: "javascript",
    expect: { silent: ["excessive-parameters"] },
    code: `
function createUser(name, email, role) {
  return { name, email, role };
}`,
  },
  {
    label: "excessive-parameters / TN: options object pattern",
    language: "javascript",
    expect: { silent: ["excessive-parameters"] },
    code: `
function createUser({ name, email, age, role, department, managerId }) {
  return { name, email, age, role, department, managerId };
}`,
  },

  // ─── callback-hell ──────────────────────────────────────────────────────────
  {
    label: "callback-hell / TP: deeply nested .then() chains",
    language: "javascript",
    expect: { fires: ["callback-hell"] },
    code: `
fetchUser(id)
  .then(user => {
    return fetchPosts(user.id).then(posts => {
      return fetchComments(posts[0].id).then(comments => {
        return fetchReplies(comments[0].id).then(replies => {
          return { user, posts, comments, replies };
        });
      });
    });
  });`,
  },
  {
    label: "callback-hell / TN: async/await flat style",
    language: "javascript",
    expect: { silent: ["callback-hell"] },
    code: `
async function loadData(id) {
  const user = await fetchUser(id);
  const posts = await fetchPosts(user.id);
  const comments = await fetchComments(posts[0].id);
  return { user, posts, comments };
}`,
  },

  // ─── magic-numbers ──────────────────────────────────────────────────────────
  {
    label: "magic-numbers / TP: same large number appears twice",
    language: "javascript",
    expect: { fires: ["magic-numbers"] },
    code: `
if (retries > 300) {
  reset();
}
setTimeout(retry, 300);`,
  },
  {
    label: "magic-numbers / TN: named constants",
    language: "javascript",
    expect: { silent: ["magic-numbers"] },
    code: `
const MAX_RETRIES = 300;
if (retries > MAX_RETRIES) {
  reset();
}`,
  },
];

// ── Runner ────────────────────────────────────────────────────────────────────

let totalChecks = 0;
let passed = 0;
let failed = 0;
const failures = [];

for (const tc of cases) {
  const result = runAnalysis(tc.code, tc.language);
  const flaggedIds = new Set(result.flags.map(f => f.id));

  const checks = [];

  for (const ruleId of (tc.expect.fires || [])) {
    totalChecks++;
    if (flaggedIds.has(ruleId)) {
      passed++;
      checks.push({ ok: true, type: "TP", rule: ruleId });
    } else {
      failed++;
      checks.push({ ok: false, type: "FN (missed)", rule: ruleId });
    }
  }

  for (const ruleId of (tc.expect.silent || [])) {
    totalChecks++;
    if (!flaggedIds.has(ruleId)) {
      passed++;
      checks.push({ ok: true, type: "TN", rule: ruleId });
    } else {
      failed++;
      checks.push({ ok: false, type: "FP (false alarm)", rule: ruleId });
    }
  }

  const allOk = checks.every(c => c.ok);
  if (!allOk) {
    failures.push({ label: tc.label, checks, flaggedIds: [...flaggedIds] });
  }
}

// ── Report ────────────────────────────────────────────────────────────────────

const accuracy = ((passed / totalChecks) * 100).toFixed(1);

console.log("\n" + "═".repeat(72));
console.log(" ACCURACY REPORT — Code Efficiency Checker Rule Engine");
console.log("═".repeat(72));
console.log(`\n  Total checks : ${totalChecks}`);
console.log(`  Passed       : ${passed}`);
console.log(`  Failed       : ${failed}`);
console.log(`  Accuracy     : ${accuracy}%`);

if (failures.length === 0) {
  console.log("\n  All checks passed ✓");
} else {
  console.log(`\n${"─".repeat(72)}`);
  console.log(" FAILURES");
  console.log("─".repeat(72));
  for (const f of failures) {
    console.log(`\n  ✗ ${f.label}`);
    console.log(`    Flagged rules: [${f.flaggedIds.join(", ") || "none"}]`);
    for (const c of f.checks.filter(x => !x.ok)) {
      console.log(`    → ${c.type}: "${c.rule}"`);
    }
  }
}

console.log("\n" + "═".repeat(72) + "\n");
