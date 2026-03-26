// ═══════════════════════════════════════════════════════════════════════════════
// ANALYSIS ENGINE — Pure analysis logic, no React dependencies
// ═══════════════════════════════════════════════════════════════════════════════

import { RULES } from '../rules/index.js';
import { COMPLEXITY_HIERARCHY } from '../config/constants.js';
import { cleanLines, detectIndentSize, nestingDepthFactory } from '../utils/codeAnalysis.js';

// Rules handled by the single-pass loop scanner (depth-sensitive)
const SINGLE_PASS_RULES = new Set([
  "linear-scan-in-loop",
  "alloc-in-loop",
  "sort-in-loop",
  "async-in-loop",
  "dom-in-loop",
]);

export function runAnalysis(code, language) {
  const rawLines = code.split("\n");
  const lines = cleanLines(rawLines);
  const flags = [];
  const passed = [];

  const indentSize = detectIndentSize(rawLines);
  const nestingDepth = nestingDepthFactory(indentSize);

  // Pre-checks used to suppress false positives inside the single-pass
  const usesDocumentFragment = /createDocumentFragment|DocumentFragment/.test(code);

  // --- 1. SINGLE PASS — loop-body rules (iterate rawLines to preserve indentation) ---
  const loopRx = /\b(for|while|forEach)\b/;
  let inLoop = false;
  let currentLoopDepth = 0;
  const triggeredRuleIds = new Set();

  for (const rawLine of rawLines) {
    const d = nestingDepth(rawLine);
    const line = rawLine.replace(/\/\/.*$/, ''); // strip line comments, keep indentation

    if (loopRx.test(line)) {
      inLoop = true;
      currentLoopDepth = d;
    }

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
      if (!triggeredRuleIds.has("dom-in-loop") && !usesDocumentFragment && /document\.(getElementById|querySelector|createElement|appendChild)|\.innerHTML|\.classList\./.test(line)) {
        triggeredRuleIds.add("dom-in-loop");
      }
      if (!triggeredRuleIds.has("string-concat-loop") && /\w+\s*\+=\s*['"`\w]|str\s*=\s*str\s*\+/.test(line)) {
        triggeredRuleIds.add("string-concat-loop");
      }
      if (!triggeredRuleIds.has("console-in-loop") && /console\.(log|warn|error)/.test(line)) {
        triggeredRuleIds.add("console-in-loop");
      }
    }

    if (inLoop && d < currentLoopDepth) {
      if (line.trim().length > 0) {
        inLoop = false;
      }
    }
  }

  // Python append-in-loop: uses indentation-based depth, needs rawLines
  const pythonLoopRx = /^\s*for\s+/;
  let inPyLoop = false;
  let pyLoopDepth = 0;
  for (const rawLine of rawLines) {
    const d = nestingDepth(rawLine);
    const line = rawLine.replace(/#.*$/, '');
    if (pythonLoopRx.test(rawLine)) { inPyLoop = true; pyLoopDepth = d; }
    if (inPyLoop && d > pyLoopDepth && /\.append\s*\(/.test(line)) {
      triggeredRuleIds.add("python-append-loop");
    }
    if (inPyLoop && d <= pyLoopDepth && !pythonLoopRx.test(rawLine) && line.trim().length > 0) {
      inPyLoop = false;
    }
  }

  // --- 2. EVALUATE ALL RULES ---
  for (const rule of RULES) {
    if (rule.languages !== "*" && !rule.languages.includes(language)) continue;

    let triggered = false;

    if (triggeredRuleIds.has(rule.id)) {
      triggered = true;
    } else if (!SINGLE_PASS_RULES.has(rule.id) && rule.id !== "string-concat-loop" && rule.id !== "console-in-loop" && rule.id !== "python-append-loop") {
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

  // --- 3. WORST COMPLEXITY ---
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

  return {
    passed,
    flags,
    stats: {
      totalRules: RULES.length,
      passed: passed.length,
      failed: flags.length,
      complexity: worstComplexity,
    },
  };
}
