// ═══════════════════════════════════════════════════════════════════════════════
// PERFORMANCE RULES — Algorithmic efficiency patterns
// ═══════════════════════════════════════════════════════════════════════════════
// Rules that detect common computational complexity issues and performance bottlenecks

import { hasNestedLoops, hasLinearScanInLoop, maxLoopDepth } from '../utils/codeAnalysis.js';

export const performanceRules = [
  {
    id: "nested-loops",
    title: "Nested Loop Detected",
    severity: "CRITICAL",
    languages: "*",
    test: (_l, _c, raw, nestingDepth) => hasNestedLoops(raw, nestingDepth),
    message: "Nested loops produce O(n²) or worse time complexity. Every element in the outer loop triggers a full inner loop traversal.",
    hint: "Flatten with a hash map/set to achieve O(n) time.",
    complexity: "O(n²)",
  },
  {
    id: "triple-nested-loops",
    title: "Triple-Nested Loop",
    severity: "CRITICAL",
    languages: "*",
    test: (_l, _c, raw, nestingDepth) => maxLoopDepth(raw, nestingDepth) >= 3,
    message: "Three or more nested loops — O(n³) complexity. Will become unusable at scale.",
    hint: "Redesign with dynamic programming or divide-and-conquer.",
    complexity: "O(n³)",
  },
  {
    id: "linear-scan-in-loop",
    title: "Linear Scan Inside Loop",
    severity: "CRITICAL",
    languages: "*",
    test: (_l, _c, raw, nestingDepth) => hasLinearScanInLoop(raw, nestingDepth),
    message: ".includes()/.indexOf()/.find() inside a loop is O(n) per iteration — O(n²) overall.",
    hint: "Pre-build a Set or Map before the loop for O(1) lookups.",
    complexity: "O(n²)",
  },
  {
    id: "alloc-in-loop",
    title: "Object/Array Allocation Inside Loop",
    severity: "HIGH",
    languages: "*",
    test: (lines, _c, _r, nestingDepth) => {
      const loopRx = /\b(for|while|forEach)\b/;
      const allocRx = /new\s+(Array|Object|Map|Set|Date|\w+)\s*\(|=\s*\[\]|=\s*\{\}/;
      let inLoop = false, depth = 0;
      for (const l of lines) {
        const d = nestingDepth(l);
        if (loopRx.test(l)) { inLoop = true; depth = d; }
        if (inLoop && d > depth && allocRx.test(l)) return true;
        if (inLoop && d <= depth) inLoop = false;
      }
      return false;
    },
    message: "Allocating new objects/arrays inside a loop causes GC pressure and inflates space complexity.",
    hint: "Declare and reuse data structures outside the loop.",
    complexity: null,
  },
  {
    id: "unbounded-recursion",
    title: "Recursion Without Memoization",
    severity: "HIGH",
    languages: "*",
    test: (_l, code) => {
      const fnMatch = code.match(/function\s+(\w+)|const\s+(\w+)\s*=\s*(?:async\s*)?\(/);
      if (!fnMatch) return false;
      const fnName = fnMatch[1] || fnMatch[2];
      const body = code.replace(new RegExp(`(function\\s+${fnName}|const\\s+${fnName})[^{]*`), "");
      const callsItself = new RegExp(`\\b${fnName}\\s*\\(`).test(body);
      const hasMemo = /memo|cache|dp\[|Map\(\)|=\s*\{\}/.test(code);
      return callsItself && !hasMemo;
    },
    message: "Recursive function with no memoization — overlapping subproblems will be recomputed exponentially.",
    hint: "Add a memo object or convert to bottom-up dynamic programming.",
    complexity: "O(2ⁿ) worst",
  },
  {
    id: "sort-in-loop",
    title: "Sort Called Inside Loop",
    severity: "HIGH",
    languages: "*",
    test: (lines, _c, _r, nestingDepth) => {
      const loopRx = /\b(for|while|forEach)\b/;
      const sortRx = /\.sort\s*\(|sorted\s*\(|Collections\.sort/;
      let inLoop = false, depth = 0;
      for (const l of lines) {
        const d = nestingDepth(l);
        if (loopRx.test(l)) { inLoop = true; depth = d; }
        if (inLoop && d > depth && sortRx.test(l)) return true;
        if (inLoop && d <= depth) inLoop = false;
      }
      return false;
    },
    message: "Sorting inside a loop is O(n log n) per iteration — O(n² log n) total.",
    hint: "Sort once before the loop, or use a sorted data structure.",
    complexity: "O(n² log n)",
  },
  {
    id: "async-in-loop",
    title: "Await Inside For/While Loop",
    severity: "HIGH",
    languages: ["javascript", "typescript"],
    test: (lines, _c, _r, nestingDepth) => {
      const loopRx = /\b(for|while)\b/;
      let inLoop = false, depth = 0;
      for (const l of lines) {
        const d = nestingDepth(l);
        if (loopRx.test(l)) { inLoop = true; depth = d; }
        if (inLoop && d > depth && /\bawait\b/.test(l)) return true;
        if (inLoop && d <= depth) inLoop = false;
      }
      return false;
    },
    message: "await inside a for/while serialises async operations — each waits for the previous, killing concurrency.",
    hint: "Use Promise.all(items.map(item => asyncFn(item))) to run concurrently.",
    complexity: "O(n × latency) serial",
  },
  {
    id: "dom-in-loop",
    title: "DOM Manipulation Inside Loop",
    severity: "HIGH",
    languages: ["javascript", "typescript"],
    test: (lines, _c, _r, nestingDepth) => {
      const loopRx = /\b(for|while|forEach)\b/;
      const domRx = /document\.(getElementById|querySelector|createElement|appendChild)|\.innerHTML|\.classList\./;
      let inLoop = false, depth = 0;
      for (const l of lines) {
        const d = nestingDepth(l);
        if (loopRx.test(l)) { inLoop = true; depth = d; }
        if (inLoop && d > depth && domRx.test(l)) return true;
        if (inLoop && d <= depth) inLoop = false;
      }
      return false;
    },
    message: "DOM reads/writes inside a loop force repeated layout reflows — extremely expensive in browsers.",
    hint: "Batch DOM reads, compute everything, then batch DOM writes. Use DocumentFragment for bulk insertions.",
    complexity: null,
  },
  {
    id: "array-as-set",
    title: "Array Used as Lookup Set",
    severity: "MEDIUM",
    languages: "*",
    test: (_l, code) =>
      /\.includes\s*\(|\.indexOf\s*\(/.test(code) && !/new Set|new Map/.test(code),
    message: "Array .includes()/.indexOf() scans every element — O(n) per lookup. Use a Set for O(1).",
    hint: "const seen = new Set(); ... seen.has(x) is O(1) vs O(n).",
    complexity: "O(n) per lookup",
  },
  {
    id: "string-concat-loop",
    title: "String Concatenation in Loop",
    severity: "MEDIUM",
    languages: "*",
    test: (lines, _c, _r, nestingDepth) => {
      const loopRx = /\b(for|while|forEach)\b/;
      const concatRx = /\w+\s*\+=\s*['"`\w]|str\s*=\s*str\s*\+/;
      let inLoop = false, depth = 0;
      for (const l of lines) {
        const d = nestingDepth(l);
        if (loopRx.test(l)) { inLoop = true; depth = d; }
        if (inLoop && d > depth && concatRx.test(l)) return true;
        if (inLoop && d <= depth) inLoop = false;
      }
      return false;
    },
    message: "String += inside a loop creates a new string object each iteration — O(n²) total memory in many runtimes.",
    hint: "Collect into an array and .join('') once at the end.",
    complexity: "O(n²) space",
  },
  {
    id: "console-in-loop",
    title: "console.log Inside Loop",
    severity: "LOW",
    languages: ["javascript", "typescript"],
    test: (lines, _c, _r, nestingDepth) => {
      const loopRx = /\b(for|while|forEach)\b/;
      let inLoop = false, depth = 0;
      for (const l of lines) {
        const d = nestingDepth(l);
        if (loopRx.test(l)) { inLoop = true; depth = d; }
        if (inLoop && d > depth && /console\.(log|warn|error)/.test(l)) return true;
        if (inLoop && d <= depth) inLoop = false;
      }
      return false;
    },
    message: "console.log inside loops is a debug artifact that serialises output synchronously on every iteration.",
    hint: "Remove in production. If needed, collect values and log once after the loop.",
    complexity: null,
  },
  {
    id: "large-function",
    title: "Excessively Long Function",
    severity: "LOW",
    languages: "*",
    test: (lines) => lines.length > 60,
    message: "",
    hint: "Extract sub-routines. Each function should have a single responsibility.",
    dynamic: (lines) => `Function/file body is ${lines.length} lines — hard to reason about, likely hides multiple responsibilities.`,
    complexity: null,
  },
  {
    id: "python-nested-comprehension",
    title: "Nested List Comprehension",
    severity: "HIGH",
    languages: ["python"],
    test: (_l, code) => /\[.+for\s+\w+\s+in\s+.+for\s+\w+\s+in\s+.+\]/.test(code),
    message: "Nested list comprehension — elegant syntax but O(n×m) complexity. Easy to misread and reason about.",
    hint: "If the inner collection is large, use a generator expression or explicit loops with early exit.",
    complexity: "O(n×m)",
  },
  {
    id: "python-append-loop",
    title: "list.append() in Loop",
    severity: "LOW",
    languages: ["python"],
    test: (lines, _c, _r, nestingDepth) => {
      const loopRx = /^\s*for\s+/;
      let inLoop = false, depth = 0;
      for (const l of lines) {
        const d = nestingDepth(l);
        if (loopRx.test(l)) { inLoop = true; depth = d; }
        if (inLoop && d > depth && /\.append\s*\(/.test(l)) return true;
        if (inLoop && d <= depth) inLoop = false;
      }
      return false;
    },
    message: ".append() in a loop is correct but list comprehensions are faster in CPython due to lower interpreter overhead.",
    hint: "result = [transform(x) for x in items]",
    complexity: null,
  },
  {
    id: "python-keys-iteration",
    title: "Redundant dict.keys() Iteration",
    severity: "LOW",
    languages: ["python"],
    test: (_l, code) => /for\s+\w+\s+in\s+\w+\.keys\(\)/.test(code),
    message: "for x in d.keys() is redundant — iterating a dict directly yields keys without an intermediate view.",
    hint: "Use: for x in d: — equivalent and marginally faster.",
    complexity: null,
  },
  {
    id: "python-in-list-literal",
    title: "Membership Test on List Literal",
    severity: "MEDIUM",
    languages: ["python"],
    test: (_l, code) => /\bin\s+\[/.test(code),
    message: "x in [a, b, c] creates a list and scans it — O(n). Use a tuple or set for constant-time membership.",
    hint: "x in (a, b, c) for small fixed sets, or x in {a, b, c} for larger ones.",
    complexity: "O(n) per check",
  },
];
