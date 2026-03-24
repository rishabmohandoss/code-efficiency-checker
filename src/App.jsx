import { useState, useRef, useCallback } from "react";

// ═══════════════════════════════════════════════════════════════════════════════
// RULE ENGINE — Pure local pattern matching, zero external dependencies
// Each rule: { id, title, severity, languages, test(lines, code, raw), message, hint }
// ═══════════════════════════════════════════════════════════════════════════════

const SEVERITY = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

// ── Helpers ──────────────────────────────────────────────────────────────────

// Improved comment stripping that handles multi-line comments properly
const cleanLines = (lines) => {
  const result = [];
  let inMultiLineComment = false;

  for (let line of lines) {
    let cleaned = line;

    // Handle multi-line comments
    if (inMultiLineComment) {
      const endIdx = cleaned.indexOf('*/');
      if (endIdx !== -1) {
        cleaned = cleaned.substring(endIdx + 2);
        inMultiLineComment = false;
      } else {
        continue; // Skip this line entirely
      }
    }

    // Remove /* */ comments (could start multi-line)
    while (cleaned.indexOf('/*') !== -1) {
      const startIdx = cleaned.indexOf('/*');
      const endIdx = cleaned.indexOf('*/', startIdx);
      if (endIdx !== -1) {
        cleaned = cleaned.substring(0, startIdx) + cleaned.substring(endIdx + 2);
      } else {
        cleaned = cleaned.substring(0, startIdx);
        inMultiLineComment = true;
        break;
      }
    }

    // Remove single-line comments (// and #)
    cleaned = cleaned.replace(/\/\/.*$|#.*$/, "").trim();

    if (cleaned) result.push(cleaned);
  }

  return result;
};

// Detect indentation style from the code
const detectIndentSize = (lines) => {
  const indents = [];
  let prevIndent = 0;

  for (const line of lines) {
    const match = line.match(/^(\s+)/);
    if (match) {
      const spaces = match[1];
      // Check for tabs
      if (spaces.includes('\t')) return 1; // Tab = 1 unit

      const currentIndent = spaces.length;
      const diff = Math.abs(currentIndent - prevIndent);
      if (diff > 0 && diff < 10) { // Reasonable indent size
        indents.push(diff);
      }
      prevIndent = currentIndent;
    }
  }

  if (indents.length === 0) return 2; // Default to 2 spaces

  // Find most common indent size
  const counts = {};
  indents.forEach(i => counts[i] = (counts[i] || 0) + 1);
  return parseInt(Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b, 2));
};

// Calculate nesting depth with auto-detected indentation
const nestingDepthFactory = (indentSize) => (line) => {
  const match = line.match(/^(\s+)/);
  if (!match) return 0;

  const spaces = match[1];
  if (spaces.includes('\t')) {
    return spaces.split('\t').length - 1;
  }
  return Math.floor(spaces.length / indentSize);
};

const hasNestedLoops = (rawLines, nestingDepth) => maxLoopDepth(rawLines, nestingDepth) >= 2;

const hasLinearScanInLoop = (rawLines, nestingDepth) => {
  const loopRx = /\b(for|while|forEach)\b/;
  const scanRx = /\.(includes|indexOf|find|filter|some|every|search)\s*\(/;
  let inLoop = false, loopDepth = 0;
  for (const line of rawLines) {
    const d = nestingDepth(line);
    if (loopRx.test(line)) { inLoop = true; loopDepth = d; }
    if (inLoop && d > loopDepth && scanRx.test(line)) return true;
    if (inLoop && d <= loopDepth && !loopRx.test(line)) inLoop = false;
  }
  return false;
};

const maxLoopDepth = (rawLines, nestingDepth) => {
  const loopRx = /\b(for|while|forEach|map|filter)\b/;
  let max = 0, cur = 0;
  for (const line of rawLines) {
    if (loopRx.test(line)) { cur++; max = Math.max(max, cur); }
    else if (/^\s*(}|\))\s*$/.test(line) && cur > 0) cur--;
  }
  return max;
};

// ── Rule Registry ─────────────────────────────────────────────────────────────
const RULES = [
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
  // ═══════════════════════════════════════════════════════════════════════════════
  // AI SLOP DETECTION RULES — Patterns common in vibecoded/AI-generated code
  // ═══════════════════════════════════════════════════════════════════════════════
  {
    id: "empty-catch",
    title: "Empty Catch Block (Error Swallowing)",
    severity: "CRITICAL",
    languages: "*",
    test: (lines) => {
      for (let i = 0; i < lines.length; i++) {
        if (/catch\s*\(/.test(lines[i])) {
          // Check if catch block is empty or only has comments
          let braceDepth = 0;
          let foundOpenBrace = false;
          let hasContent = false;

          for (let j = i; j < Math.min(i + 5, lines.length); j++) {
            const line = lines[j].trim();

            if (line.includes('{')) {
              foundOpenBrace = true;
              braceDepth++;
            }

            if (foundOpenBrace && braceDepth > 0) {
              // Check if there's actual code (not just braces)
              const codeContent = line.replace(/[{}]/g, '').trim();
              if (codeContent.length > 0) {
                hasContent = true;
              }
            }

            if (line.includes('}')) {
              braceDepth--;
              if (braceDepth === 0 && foundOpenBrace && !hasContent) {
                return true; // Found empty catch
              }
            }
          }
        }
      }
      return false;
    },
    message: "Empty catch blocks silently swallow errors, making debugging impossible. AI-generated code often adds try-catch 'defensively' without proper error handling.",
    hint: "Add logging, user feedback, or rethrow: catch(e) { console.error('Failed:', e); throw e; }",
    complexity: null,
  },
  {
    id: "missing-null-check",
    title: "Property Access Without Null/Undefined Check",
    severity: "HIGH",
    languages: "*",
    test: (_l, code) => {
      // Look for chained property access patterns
      const chainedAccess = /(\w+)\.(\w+)\.(\w+)/;
      const optionalChaining = /\?\.|\?\[/;
      const nullishCoalescing = /\?\?/;
      const nullCheck = /if\s*\(\s*!?\w+\s*\)|&&\s*\w+\s*\./;

      // If there's chained access without safety mechanisms
      return chainedAccess.test(code) &&
             !optionalChaining.test(code) &&
             !nullishCoalescing.test(code) &&
             !nullCheck.test(code);
    },
    message: "Accessing nested properties without null checks causes runtime errors. AI code often assumes the 'happy path' where all objects exist.",
    hint: "Use optional chaining (obj?.prop?.nested) or add explicit checks: if (!obj || !obj.prop) return null;",
    complexity: null,
  },
  {
    id: "unhandled-promise",
    title: "Async Operation Without Error Handling",
    severity: "HIGH",
    languages: ["javascript", "typescript"],
    test: (_l, code) => {
      const hasAsyncOp = /\b(fetch|axios\.|api\.)\w*\(|new Promise\(/;
      const hasCatch = /\.catch\(|try\s*\{[\s\S]*catch/;
      const hasAwait = /await\s+/;

      // If there's an async operation
      if (hasAsyncOp.test(code)) {
        // Check if it's awaited inside try-catch OR has .catch()
        if (hasAwait.test(code)) {
          // await used - need try-catch
          return !hasCatch.test(code);
        } else {
          // Promise chain - need .catch()
          return !/\.catch\(/.test(code);
        }
      }
      return false;
    },
    message: "Unhandled promise rejections crash Node apps and create silent failures in browsers. AI often forgets error handling for async operations.",
    hint: "Add .catch() to promise chains or wrap await calls in try-catch blocks.",
    complexity: null,
  },
  {
    id: "infinite-loop-risk",
    title: "While Loop Without Clear Termination",
    severity: "HIGH",
    languages: "*",
    test: (lines, code) => {
      const whileTrue = /while\s*\(\s*true\s*\)|while\s*\(\s*1\s*\)/;
      const hasBreak = /\bbreak\b/;
      const hasReturn = /\breturn\b/;

      // while(true) without break/return is dangerous
      if (whileTrue.test(code)) {
        // Check if there's a break or return inside
        const afterWhile = code.substring(code.search(whileTrue));
        const firstBrace = afterWhile.indexOf('{');
        const closingBrace = afterWhile.indexOf('}', firstBrace);
        const loopBody = afterWhile.substring(firstBrace, closingBrace);

        return !hasBreak.test(loopBody) && !hasReturn.test(loopBody);
      }
      return false;
    },
    message: "Infinite loops without exit conditions freeze applications. AI code sometimes uses while(true) without proper break logic.",
    hint: "Add a break statement, return, or use a condition: while(condition) instead of while(true).",
    complexity: null,
  },
  {
    id: "excessive-parameters",
    title: "Function Has Too Many Parameters",
    severity: "MEDIUM",
    languages: "*",
    test: (_l, code) => {
      const funcRx = /(?:function\s+\w+|const\s+\w+\s*=\s*(?:async\s*)?\([^)]*\)\s*=>|\w+\s*\([^)]*\)\s*\{)\s*\(([^)]+)\)/g;
      const arrowRx = /(?:const|let|var)\s+\w+\s*=\s*(?:async\s*)?\(([^)]+)\)\s*=>/g;
      const standardRx = /function\s+\w+\s*\(([^)]+)\)/g;

      const checkParams = (match) => {
        if (!match || !match[1]) return false;
        const params = match[1].split(',').map(p => p.trim()).filter(p => p.length > 0);
        return params.length > 5;
      };

      let match;
      while ((match = standardRx.exec(code)) !== null) {
        if (checkParams(match)) return true;
      }
      while ((match = arrowRx.exec(code)) !== null) {
        if (checkParams(match)) return true;
      }

      return false;
    },
    message: "Functions with >5 parameters are hard to maintain and test. AI often generates verbose function signatures instead of using objects or builder patterns.",
    hint: "Refactor to use an options object: function(config) where config = { param1, param2, ... }",
    complexity: null,
  },
  {
    id: "callback-hell",
    title: "Deeply Nested Callbacks (Callback Hell)",
    severity: "MEDIUM",
    languages: ["javascript", "typescript"],
    test: (lines) => {
      let maxDepth = 0;
      let currentDepth = 0;
      const callbackPatterns = /\.then\(|\.catch\(|\w+\s*\([^)]*,\s*(?:function|async|\()/;

      for (let line of lines) {
        // Count opening of callbacks
        if (callbackPatterns.test(line) || /=>\s*\{/.test(line)) {
          currentDepth++;
          maxDepth = Math.max(maxDepth, currentDepth);
        }
        // Count closing braces that might close callbacks
        const closingBraces = (line.match(/\}\)/g) || []).length;
        currentDepth = Math.max(0, currentDepth - closingBraces);
      }

      return maxDepth >= 4;
    },
    message: "Nested callbacks >3 levels deep create 'callback hell' — hard to read and maintain. AI often generates sequential async code instead of using async/await.",
    hint: "Refactor to async/await: Instead of .then().then().then(), use await sequentially or Promise.all() for parallel operations.",
    complexity: null,
  },
  {
    id: "magic-numbers",
    title: "Magic Numbers Without Constants",
    severity: "LOW",
    languages: "*",
    test: (_l, code) => {
      // Look for numeric literals (not 0, 1, -1, 2) that appear multiple times
      const numberRx = /(?<![.\w])(?![-]?[012]\b)[-]?\d{2,}(?![.\w])/g;
      const numbers = code.match(numberRx) || [];

      // Check if same number appears multiple times
      const counts = {};
      numbers.forEach(n => counts[n] = (counts[n] || 0) + 1);
      return Object.values(counts).some(count => count >= 2);
    },
    message: "Magic numbers (hardcoded values) scattered throughout code make it hard to maintain. AI often generates literal values instead of named constants.",
    hint: "Extract to constants: const MAX_RETRIES = 3; const TIMEOUT_MS = 5000;",
    complexity: null,
  },
];

const COMPLEXITY_HIERARCHY = {
  "O(2ⁿ) worst": 60,
  "O(n³)": 50,
  "O(n² log n)": 40,
  "O(n²)": 30,
  "O(n² space)": 30,
  "O(n×m)": 30,
  "O(n) per check": 10,
  "O(n)": 10
};

// ── Run engine ────────────────────────────────────────────────────────────────
function runAnalysis(code, language) {
  const rawLines = code.split("\n");
  const lines = cleanLines(rawLines);
  const flags = [];
  const passed = [];

  // Detect indentation and create nestingDepth function
  const indentSize = detectIndentSize(rawLines);
  const nestingDepth = nestingDepthFactory(indentSize);

  // --- 1. SINGLE PASS ARCHITECTURE (Fixes O(n³)) ---
  // We scan the file exactly ONCE to check all loop-related rules.
  const loopRx = /\b(for|while|forEach)\b/;
  let inLoop = false;
  let currentLoopDepth = 0;
  const triggeredRuleIds = new Set();

  for (const line of lines) {
    const d = nestingDepth(line);

    // Start tracking loop
    if (loopRx.test(line)) {
      inLoop = true;
      currentLoopDepth = d;
    }

    // Check for issues inside loop (must be at greater depth)
    if (inLoop && d > currentLoopDepth) {
      if (!triggeredRuleIds.has("linear-scan-in-loop") && /\.(includes|indexOf|find|filter|some|every|search)\s*\(/.test(line)) {
        triggeredRuleIds.add("linear-scan-in-loop");
      }
      if (!triggeredRuleIds.has("alloc-in-loop") && /new\s+(Array|Object|Map|Set|Date|\w+)\s*\(|=\s*\[\]|=\s*\{\}/.test(line)) {
        triggeredRuleIds.add("alloc-in-loop");
      }
      if (!triggeredRuleIds.has("sort-in-loop") && /\.sort\s*\(|sorted\s*\(|Collections\.sort/.test(line)) {
        triggeredRuleIds.add("sort-in-loop");
      }
      if (!triggeredRuleIds.has("async-in-loop") && /\bawait\b/.test(line)) {
        triggeredRuleIds.add("async-in-loop");
      }
    }

    // Exit loop tracking when depth drops below loop level
    // AND the line has actual content (not just whitespace/braces)
    if (inLoop && d < currentLoopDepth && line.trim().length > 0 && !/^[}\])]\s*$/.test(line.trim())) {
      inLoop = false;
    }
  }

  // --- 2. EVALUATE RULES ---
  for (const rule of RULES) {
    if (rule.languages !== "*" && !rule.languages.includes(language)) continue;
    
    let triggered = false;

    // Check if our single-pass already caught it
    if (triggeredRuleIds.has(rule.id)) {
      triggered = true;
    } 
    // Otherwise, run the standard test for non-loop rules
    else if (!["linear-scan-in-loop", "alloc-in-loop", "sort-in-loop", "async-in-loop"].includes(rule.id)) {
      try {
        triggered = rule.test(lines, code, rawLines, nestingDepth);
      } catch (_) {}
    }

    if (triggered) {
      flags.push({ ...rule, message: rule.dynamic ? rule.dynamic(lines) : rule.message, pass: false });
    } else {
      passed.push(rule);
    }
  }

  // --- 3. CALCULATE COMPLEXITIES (Fixes O(n²) Scans) ---
  let worstScore = 0;
  let worstComplexity = "O(n)";

  for (const flag of flags) {
    if (flag.complexity && COMPLEXITY_HIERARCHY[flag.complexity]) {
      const score = COMPLEXITY_HIERARCHY[flag.complexity];
      if (score > worstScore) {
        worstScore = score;
        worstComplexity = flag.complexity;
      }
    }
  }

  if (worstScore === 0 && flags.some(f => f.severity === "CRITICAL")) {
    worstComplexity = "O(n²)";
  }

  const spaceComplexity =
    flags.some(f => f.id === "string-concat-loop") ? "O(n²)" :
    flags.some(f => f.id === "alloc-in-loop") ? "O(n) avoidable" : "O(n)";

  // --- 4. BUILD FINAL RESULT OBJECT ---
  const critCount = flags.filter(f => f.severity === "CRITICAL").length;
  const highCount = flags.filter(f => f.severity === "HIGH").length;

  return {
    flags,
    passed,
    worstComplexity,
    spaceComplexity,
    overallPass: critCount === 0 && highCount === 0,
    passRate: Math.round((passed.length / (flags.length + passed.length || 1)) * 100),
    critCount,
    highCount,
    medCount: flags.filter(f => f.severity === "MEDIUM").length,
    lowCount: flags.filter(f => f.severity === "LOW").length,
    lineCount: rawLines.length,
    language,
  };
} // <-- End of runAnalysis function

// ═══════════════════════════════════════════════════════════════════════════════
// GITHUB FETCHER
// ═══════════════════════════════════════════════════════════════════════════════

function parseGitHubUrl(url) {
  const m = url.match(/github\.com\/([^/]+)\/([^/]+)(?:\/(?:blob|tree)\/([^/]+)\/(.+))?/);
  if (!m) return null;
  return { owner: m[1], repo: m[2], branch: m[3] || "main", path: m[4] || "" };
}

async function fetchGitHubFile(info) {
  // Add timeout to prevent hanging
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

  try {
    const res = await fetch(
      `https://api.github.com/repos/${info.owner}/${info.repo}/contents/${info.path}?ref=${info.branch}`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);

    if (!res.ok) {
      if (res.status === 404) throw new Error("File not found. Check the URL and ensure the repository is public.");
      if (res.status === 403) throw new Error("API rate limit exceeded. Try again in a few minutes.");
      throw new Error(`GitHub ${res.status} — repo may be private or URL invalid`);
    }

    const data = await res.json();
    if (data.encoding === "base64") {
      const decoded = atob(data.content.replace(/\n/g, ""));
      // Validate decoded size (max 1MB)
      if (decoded.length > 1024 * 1024) {
        throw new Error("File too large (>1MB). Please use a smaller file.");
      }
      return decoded;
    }
    throw new Error("Unexpected GitHub response format");
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error("Request timed out. GitHub API may be slow or unreachable.");
    }
    throw err;
  }
}

const EXT_LANG = { py:"python",js:"javascript",ts:"typescript",java:"java",cpp:"cpp",go:"go",rs:"rust",c:"c",rb:"ruby",swift:"swift" };
const LANGUAGES = ["python","javascript","typescript","java","cpp","go","rust","c","ruby","swift"];

// ═══════════════════════════════════════════════════════════════════════════════
// UI COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

const SEV = {
  CRITICAL: { bg:"#ef444418", border:"#ef444450", text:"#f87171",  bar:"#ef4444" },
  HIGH:     { bg:"#f9731618", border:"#f9731650", text:"#fb923c",  bar:"#f97316" },
  MEDIUM:   { bg:"#eab30818", border:"#eab30850", text:"#fbbf24",  bar:"#eab308" },
  LOW:      { bg:"#6b728018", border:"#6b728050", text:"#9ca3af",  bar:"#6b7280" },
};

function Badge({ sev }) {
  const s = SEV[sev];
  return (
    <span style={{
      padding:"2px 8px", borderRadius:4, fontSize:10, fontWeight:700,
      letterSpacing:"0.12em", fontFamily:"'Fira Code',monospace",
      background:s.bg, border:`1px solid ${s.border}`, color:s.text, flexShrink:0,
    }}>{sev}</span>
  );
}

function OverallVerdict({ result }) {
  const { overallPass, passRate, critCount, highCount, medCount, lowCount, worstComplexity, spaceComplexity, lineCount, flags, passed } = result;
  const accent = overallPass ? "#22c55e" : "#ef4444";
  return (
    <div style={{
      borderRadius:12, overflow:"hidden",
      border:`1px solid ${accent}30`,
      background:`${accent}06`,
    }}>
      {/* Top bar */}
      <div style={{
        display:"flex", alignItems:"center", gap:16, padding:"18px 24px",
        borderBottom:`1px solid ${accent}15`,
      }}>
        <div style={{
          width:48, height:48, borderRadius:"50%",
          display:"flex", alignItems:"center", justifyContent:"center",
          background:`${accent}15`, border:`2px solid ${accent}40`,
          fontSize:22, flexShrink:0,
          boxShadow:`0 0 16px ${accent}25`,
        }}>
          {overallPass ? "✓" : "✗"}
        </div>
        <div>
          <div style={{
            fontFamily:"'Syne',sans-serif", fontSize:22, fontWeight:900,
            color:accent, lineHeight:1, letterSpacing:"-0.02em",
          }}>
            {overallPass ? "PASS" : "FAIL"}
          </div>
          <div style={{ fontFamily:"'Fira Code',monospace", fontSize:11, color:"#475569", marginTop:3 }}>
            {passRate}% of applicable rules passed · {flags.length} flag{flags.length!==1?"s":""} raised
          </div>
        </div>
        <div style={{ marginLeft:"auto", textAlign:"right" }}>
          <div style={{ fontFamily:"'Fira Code',monospace", fontSize:10, color:"#334155", marginBottom:4 }}>WORST-CASE TIME</div>
          <div style={{ fontFamily:"'Fira Code',monospace", fontSize:16, fontWeight:700, color:"#e2e8f0" }}>{worstComplexity}</div>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display:"flex", flexWrap:"wrap", gap:0 }}>
        {[
          { label:"CRITICAL", val:critCount, color:"#ef4444" },
          { label:"HIGH",     val:highCount, color:"#f97316" },
          { label:"MEDIUM",   val:medCount,  color:"#eab308" },
          { label:"LOW",      val:lowCount,  color:"#6b7280" },
          { label:"SPACE",    val:spaceComplexity, color:"#94a3b8", wide:true },
          { label:"LINES",    val:lineCount,  color:"#94a3b8" },
        ].map(({label, val, color, wide}, i, arr) => (
          <div key={label} style={{
            flex: wide ? "2 1 120px" : "1 1 70px",
            padding:"14px 18px",
            borderRight: i < arr.length-1 ? "1px solid #1e2030" : "none",
            borderTop:"1px solid #1e2030",
          }}>
            <div style={{ fontFamily:"'Fira Code',monospace", fontSize:9, color:"#334155", letterSpacing:"0.15em", marginBottom:5 }}>{label}</div>
            <div style={{ fontFamily:"'Fira Code',monospace", fontSize: wide ? 13 : 20, fontWeight:700, color }}>{val}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FlagCard({ flag }) {
  const [open, setOpen] = useState(false);
  const s = SEV[flag.severity];
  return (
    <div style={{
      borderRadius:10, overflow:"hidden",
      border:`1px solid ${s.border}`,
      background:s.bg,
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width:"100%", padding:"13px 16px",
          display:"flex", alignItems:"center", gap:12,
          background:"transparent", border:"none", cursor:"pointer",
        }}
      >
        <div style={{ width:3, height:32, borderRadius:2, background:s.bar, flexShrink:0 }} />
        <Badge sev={flag.severity} />
        <span style={{
          fontFamily:"'Fira Code',monospace", fontSize:13, fontWeight:700,
          color:"#e2e8f0", textAlign:"left", flex:1,
        }}>{flag.title}</span>
        {flag.complexity && (
          <span style={{
            padding:"2px 8px", borderRadius:4, fontSize:10,
            background:"#ffffff0a", color:"#64748b",
            fontFamily:"'Fira Code',monospace", flexShrink:0,
          }}>{flag.complexity}</span>
        )}
        <span style={{ color:"#334155", fontSize:11, flexShrink:0, marginLeft:4 }}>{open?"▲":"▼"}</span>
      </button>
      {open && (
        <div style={{ padding:"0 16px 14px 16px", borderTop:`1px solid ${s.border}20` }}>
          <p style={{
            fontFamily:"'Fira Code',monospace", fontSize:12, color:"#94a3b8",
            lineHeight:1.75, margin:"12px 0 10px",
          }}>{flag.message}</p>
          <div style={{
            padding:"9px 13px", borderRadius:8,
            background:"#ffffff06", border:"1px solid #ffffff10",
          }}>
            <span style={{ fontFamily:"'Fira Code',monospace", fontSize:10, color:"#334155", letterSpacing:"0.1em" }}>HINT → </span>
            <span style={{ fontFamily:"'Fira Code',monospace", fontSize:12, color:"#7dd3fc" }}>{flag.hint}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function PassedList({ passed }) {
  if (!passed.length) return (
    <div style={{
      padding:32, textAlign:"center", borderRadius:12,
      background:"#1e203008", border:"1px solid #1e2030",
      fontFamily:"'Fira Code',monospace", color:"#334155", fontSize:12,
    }}>No applicable rules passed (all triggered).</div>
  );
  return (
    <div style={{ padding:20, borderRadius:12, background:"#22c55e06", border:"1px solid #22c55e20" }}>
      <div style={{ fontFamily:"'Fira Code',monospace", fontSize:10, color:"#22c55e", letterSpacing:"0.2em", marginBottom:14 }}>
        PASSED CHECKS ({passed.length})
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {passed.map(r => (
          <div key={r.id} style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{
              width:18, height:18, borderRadius:"50%",
              display:"flex", alignItems:"center", justifyContent:"center",
              background:"#22c55e20", border:"1px solid #22c55e50",
              color:"#22c55e", fontSize:10, fontWeight:900, flexShrink:0,
            }}>✓</div>
            <span style={{ fontFamily:"'Fira Code',monospace", fontSize:12, color:"#22c55e" }}>{r.title}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      padding:"9px 16px",
      background: active ? "#e2e8f0" : "transparent",
      color: active ? "#0a0a12" : "#475569",
      border: active ? "none" : "1px solid #1e2030",
      borderRadius:6, cursor:"pointer",
      fontFamily:"'Fira Code',monospace", fontSize:11,
      fontWeight:700, letterSpacing:"0.08em",
      transition:"all 0.15s",
    }}>{children}</button>
  );
}

function MethodTab({ active, onClick, label }) {
  return (
    <button onClick={onClick} style={{
      flex:1, padding:"13px 8px",
      background: active ? "#13151f" : "transparent",
      color: active ? "#e2e8f0" : "#334155",
      border:"none",
      borderBottom: active ? "2px solid #e2e8f0" : "2px solid transparent",
      cursor:"pointer",
      fontFamily:"'Fira Code',monospace", fontSize:11,
      fontWeight:700, letterSpacing:"0.12em",
      transition:"all 0.15s",
    }}>{label}</button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════════

const PLACEHOLDER = `// Paste your code — the engine checks for nested loops,
// O(n²) array scans, unbounded recursion, DOM thrashing, and more.

function findDuplicates(arr) {
  const dupes = [];
  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) {    // ← nested loop → CRITICAL
      if (arr[i] === arr[j] && !dupes.includes(arr[i])) {  // ← .includes() → CRITICAL
        dupes.push(arr[i]);
      }
    }
  }
  return dupes;
}`;

export default function App() {
  const [method,   setMethod]   = useState("paste");
  const [code,     setCode]     = useState("");
  const [lang,     setLang]     = useState("javascript");
  const [ghUrl,    setGhUrl]    = useState("");
  const [dragging, setDragging] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [fileName, setFileName] = useState("");
  const [result,   setResult]   = useState(null);
  const [error,    setError]    = useState("");
  const [tab,      setTab]      = useState("flags");
  const fileRef = useRef(null);

  const handleFileRead = useCallback((file) => {
    // Validate file size (max 5MB)
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB in bytes
    if (file.size > MAX_FILE_SIZE) {
      setError(`File too large (${(file.size / 1024 / 1024).toFixed(2)}MB). Maximum size is 5MB.`);
      return;
    }

    // Validate file type by extension
    const ext = file.name.split(".").pop().toLowerCase();
    if (!EXT_LANG[ext]) {
      setError(`Unsupported file type: .${ext}. Please upload a code file (.py, .js, .ts, etc.)`);
      return;
    }

    setError("");
    setLang(EXT_LANG[ext]);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = e => setCode(e.target.result);
    reader.onerror = () => setError("Failed to read file. Please try again.");
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback(e => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileRead(file);
  }, [handleFileRead]);

  const handleAnalyze = () => {
    if (!code.trim()) { setError("No code to analyze."); return; }
    setError("");
    setResult(runAnalysis(code, lang));
    setTab("flags");
  };

  const handleGitHub = async () => {
    if (!ghUrl.trim()) { setError("Enter a GitHub file URL."); return; }
    const info = parseGitHubUrl(ghUrl);
    if (!info || !info.path) { setError("URL must point to a specific file (blob URL)."); return; }
    setError(""); setFetching(true);
    try {
      const fetched = await fetchGitHubFile(info);
      const ext = info.path.split(".").pop().toLowerCase();
      const detectedLang = EXT_LANG[ext] || "javascript";
      setLang(detectedLang);
      setCode(fetched);
      setFileName(info.path.split("/").pop());
      setResult(runAnalysis(fetched, detectedLang));
      setTab("flags");
    } catch(e) {
      setError(`GitHub error: ${e.message}`);
    } finally {
      setFetching(false);
    }
  };

  const reset = () => { setResult(null); setCode(""); setGhUrl(""); setFileName(""); setError(""); };

  return (
    <div style={{ minHeight:"100vh", background:"#0a0a12", color:"#e2e8f0" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;700&family=Syne:wght@700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        body{background:#0a0a12;}
        ::-webkit-scrollbar{width:5px;height:5px;}
        ::-webkit-scrollbar-track{background:transparent;}
        ::-webkit-scrollbar-thumb{background:#1e2030;border-radius:3px;}
        textarea,input,select{outline:none;}
        @keyframes slide-in{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        .fade-in{animation:slide-in 0.28s ease both;}
      `}</style>

      {/* Grid bg */}
      <div style={{
        position:"fixed", inset:0, pointerEvents:"none", zIndex:0,
        backgroundImage:"linear-gradient(#ffffff03 1px,transparent 1px),linear-gradient(90deg,#ffffff03 1px,transparent 1px)",
        backgroundSize:"48px 48px",
      }}/>

      <div style={{ position:"relative", zIndex:1, maxWidth:820, margin:"0 auto", padding:"48px 20px 80px" }}>

        {/* ── Header ── */}
        <div style={{ marginBottom:44 }}>
          <div style={{
            fontFamily:"'Fira Code',monospace", fontSize:10, color:"#1e2a3a",
            letterSpacing:"0.4em", marginBottom:10, textTransform:"uppercase",
          }}>
            Local Static Analysis · {RULES.length} Rules · Zero Network Calls
          </div>
          <h1 style={{
            fontFamily:"'Syne',sans-serif",
            fontSize:"clamp(38px,8vw,72px)",
            fontWeight:900, lineHeight:.9,
            letterSpacing:"-0.03em",
            color:"#f1f5f9", marginBottom:14,
          }}>
            CODE<br/>
            <span style={{ WebkitTextStroke:"1px #334155", color:"transparent" }}>EFFICIENCY</span><br/>
            CHECKER
          </h1>
          <p style={{
            fontFamily:"'Fira Code',monospace", fontSize:12, color:"#334155",
            lineHeight:1.75, maxWidth:440,
          }}>
            Pattern-matches against {RULES.length} algorithmic rules.
            Returns pass/fail per check with Big O inference.
            No API. No backend. Runs entirely in your browser.
          </p>
        </div>

        {/* ── Input panel ── */}
        {!result && (
          <div className="fade-in" style={{
            background:"#0d0f1a", border:"1px solid #1e2030",
            borderRadius:14, overflow:"hidden", marginBottom:20,
          }}>
            <div style={{ display:"flex", borderBottom:"1px solid #1e2030" }}>
              <MethodTab active={method==="paste"}  onClick={() => { setMethod("paste");  setError(""); }} label="PASTE CODE" />
              <MethodTab active={method==="upload"} onClick={() => { setMethod("upload"); setError(""); }} label="UPLOAD FILE" />
              <MethodTab active={method==="github"} onClick={() => { setMethod("github"); setError(""); }} label="GITHUB URL" />
            </div>

            <div style={{ padding:24 }}>
              {/* Lang selector */}
              {method !== "github" && (
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
                  <span style={{ fontFamily:"'Fira Code',monospace", fontSize:10, color:"#334155", letterSpacing:"0.15em" }}>LANGUAGE</span>
                  <select value={lang} onChange={e => setLang(e.target.value)} style={{
                    background:"#13151f", color:"#94a3b8",
                    border:"1px solid #1e2030", borderRadius:6,
                    padding:"5px 10px", fontFamily:"'Fira Code',monospace", fontSize:12, cursor:"pointer",
                  }}>
                    {LANGUAGES.map(l => <option key={l}>{l}</option>)}
                  </select>
                  {fileName && <span style={{ fontFamily:"'Fira Code',monospace", fontSize:11, color:"#22c55e" }}>✓ {fileName}</span>}
                </div>
              )}

              {method === "paste" && (
                <textarea
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  placeholder={PLACEHOLDER}
                  spellCheck={false}
                  style={{
                    width:"100%", minHeight:260, padding:18,
                    background:"#080811", border:"1px solid #1e2030",
                    borderRadius:10, color:"#c9d1d9",
                    fontFamily:"'Fira Code',monospace", fontSize:12.5,
                    lineHeight:1.65, resize:"vertical",
                  }}
                />
              )}

              {method === "upload" && (
                <div
                  onDragOver={e => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileRef.current?.click()}
                  style={{
                    border:`2px dashed ${dragging ? "#e2e8f0" : "#1e2030"}`,
                    borderRadius:12, padding:"56px 20px", textAlign:"center",
                    cursor:"pointer", transition:"border-color 0.2s",
                    background: dragging ? "#ffffff04" : "transparent",
                  }}
                >
                  <input ref={fileRef} type="file"
                    accept=".py,.js,.ts,.java,.cpp,.go,.rs,.c,.rb,.swift"
                    style={{ display:"none" }}
                    onChange={e => { if (e.target.files[0]) handleFileRead(e.target.files[0]); }}
                  />
                  <div style={{ fontSize:32, marginBottom:14 }}>⬆</div>
                  <div style={{ fontFamily:"'Fira Code',monospace", fontSize:12, color: fileName ? "#22c55e" : "#334155", marginBottom:6 }}>
                    {fileName ? `✓ ${fileName} loaded` : "DROP FILE OR CLICK TO BROWSE"}
                  </div>
                  <div style={{ fontFamily:"'Fira Code',monospace", color:"#1e2030", fontSize:10 }}>
                    .py .js .ts .java .cpp .go .rs .c .rb .swift
                  </div>
                </div>
              )}

              {method === "github" && (
                <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                  <div style={{ fontFamily:"'Fira Code',monospace", fontSize:10, color:"#334155", letterSpacing:"0.15em" }}>
                    PUBLIC FILE BLOB URL
                  </div>
                  <input
                    value={ghUrl}
                    onChange={e => setGhUrl(e.target.value)}
                    placeholder="https://github.com/owner/repo/blob/main/path/to/file.py"
                    style={{
                      width:"100%", padding:"13px 16px",
                      background:"#080811", border:"1px solid #1e2030",
                      borderRadius:8, color:"#c9d1d9",
                      fontFamily:"'Fira Code',monospace", fontSize:12,
                    }}
                  />
                  <div style={{ fontFamily:"'Fira Code',monospace", fontSize:10, color:"#1e3040" }}>
                    ⚠ Public repositories only · Paste the blob file URL, not the repo root
                  </div>
                </div>
              )}

              {error && (
                <div style={{
                  marginTop:14, padding:"10px 14px",
                  background:"#ef444410", border:"1px solid #ef444430",
                  borderRadius:8, color:"#ef4444",
                  fontFamily:"'Fira Code',monospace", fontSize:12,
                }}>✗ {error}</div>
              )}

              <button
                onClick={method === "github" ? handleGitHub : handleAnalyze}
                disabled={fetching}
                style={{
                  marginTop:18, width:"100%", padding:"14px",
                  background:"#e2e8f0", color:"#0a0a12",
                  border:"none", borderRadius:10,
                  fontFamily:"'Fira Code',monospace", fontSize:13,
                  fontWeight:700, letterSpacing:"0.12em",
                  cursor: fetching ? "not-allowed" : "pointer",
                  opacity: fetching ? 0.6 : 1,
                  transition:"opacity 0.2s",
                }}
              >
                {fetching ? "FETCHING..." : "▶ RUN ANALYSIS"}
              </button>
            </div>
          </div>
        )}

        {/* ── Results ── */}
        {result && (
          <div className="fade-in" style={{ display:"flex", flexDirection:"column", gap:18 }}>

            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <button onClick={reset} style={{
                padding:"8px 16px", background:"transparent",
                color:"#334155", border:"1px solid #1e2030",
                borderRadius:6, cursor:"pointer",
                fontFamily:"'Fira Code',monospace", fontSize:11, fontWeight:700,
              }}>← NEW ANALYSIS</button>
              <div style={{ fontFamily:"'Fira Code',monospace", fontSize:10, color:"#1e2030", letterSpacing:"0.1em" }}>
                {result.language.toUpperCase()} · {RULES.filter(r => r.languages==="*" || r.languages.includes(result.language)).length} RULES APPLIED
              </div>
            </div>

            <OverallVerdict result={result} />

            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              <TabBtn active={tab==="flags"}  onClick={() => setTab("flags")}>
                ✗ FLAGS ({result.flags.length})
              </TabBtn>
              <TabBtn active={tab==="passed"} onClick={() => setTab("passed")}>
                ✓ PASSED ({result.passed.length})
              </TabBtn>
              <TabBtn active={tab==="source"} onClick={() => setTab("source")}>
                ‹/› SOURCE
              </TabBtn>
            </div>

            {tab === "flags" && (
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {result.flags.length === 0 ? (
                  <div style={{
                    padding:32, textAlign:"center", borderRadius:12,
                    background:"#22c55e08", border:"1px solid #22c55e20",
                    fontFamily:"'Fira Code',monospace", color:"#22c55e", fontSize:13,
                  }}>
                    No flags raised — all pattern checks passed.
                  </div>
                ) : (
                  [...result.flags]
                    .sort((a,b) => SEVERITY[b.severity] - SEVERITY[a.severity])
                    .map(flag => <FlagCard key={flag.id} flag={flag} />)
                )}
              </div>
            )}

            {tab === "passed" && <PassedList passed={result.passed} />}

            {tab === "source" && (
              <div style={{
                background:"#080811", border:"1px solid #1e2030",
                borderRadius:12, overflow:"hidden",
              }}>
                <div style={{
                  display:"flex", alignItems:"center", justifyContent:"space-between",
                  padding:"10px 16px", background:"#0d0f1a", borderBottom:"1px solid #1e2030",
                }}>
                  <span style={{ fontFamily:"'Fira Code',monospace", fontSize:11, color:"#334155" }}>
                    {fileName || "source"} · {result.lineCount} lines · {result.language}
                  </span>
                  <button onClick={() => navigator.clipboard.writeText(code)} style={{
                    padding:"3px 10px", background:"transparent", color:"#334155",
                    border:"1px solid #1e2030", borderRadius:4, cursor:"pointer",
                    fontFamily:"'Fira Code',monospace", fontSize:10,
                  }}>COPY</button>
                </div>
                <pre style={{
                  margin:0, padding:20, overflowX:"auto",
                  fontSize:12, lineHeight:1.65, color:"#94a3b8",
                  fontFamily:"'Fira Code',monospace",
                  maxHeight:420, overflowY:"auto",
                }}>
                  {code.split("\n").map((line, i) => (
                    <div key={i} style={{ display:"flex", gap:16 }}>
                      <span style={{ color:"#1e2030", minWidth:28, textAlign:"right", userSelect:"none", flexShrink:0 }}>{i+1}</span>
                      <span style={{ whiteSpace:"pre" }}>{line}</span>
                    </div>
                  ))}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div style={{
          marginTop:60, textAlign:"center",
          fontFamily:"'Fira Code',monospace", color:"#13151f", fontSize:10, letterSpacing:"0.15em",
        }}>
          {RULES.length} LOCAL RULES · ZERO API CALLS · NO CODE EXECUTED · SAFE FOR CI/CD
        </div>
      </div>
    </div>
  );
}
