// ═══════════════════════════════════════════════════════════════════════════════
// AI SLOP DETECTION RULES — Patterns common in vibecoded/AI-generated code
// ═══════════════════════════════════════════════════════════════════════════════
// Rules that detect common issues in AI-generated code: missing error handling,
// missing null checks, infinite loop risks, excessive parameters, callback hell

export const aiSlopRules = [
  {
    id: "empty-catch",
    title: "Empty Catch Block (Error Swallowing)",
    severity: "CRITICAL",
    languages: "*",
    test: (lines, code) => {
      // Check for inline empty catch: catch(e) {} or catch (e) {}
      if (/catch\s*\([^)]*\)\s*\{\s*\}/.test(code)) {
        return true;
      }

      // Check for multi-line empty catch blocks
      for (let i = 0; i < lines.length; i++) {
        if (/catch\s*\(/.test(lines[i])) {
          let braceDepth = 0;
          let foundOpenBrace = false;
          let hasContent = false;
          let searchLimit = Math.min(i + 10, lines.length); // Increased search range

          for (let j = i; j < searchLimit; j++) {
            const line = lines[j].trim();
            // Skip comments and empty lines
            if (line.startsWith('//') || line.startsWith('/*') || line.startsWith('*') || line.length === 0) {
              continue;
            }

            if (line.includes('{')) {
              foundOpenBrace = true;
              braceDepth++;
            }

            if (foundOpenBrace && braceDepth > 0) {
              // Check if there's actual code (not just braces, comments, or whitespace)
              const codeContent = line
                .replace(/[{}]/g, '')
                .replace(/\/\/.*/g, '') // Remove line comments
                .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
                .trim();

              // Real content if it's not empty and not just TODO/FIXME comments
              if (codeContent.length > 0 && !/^(TODO|FIXME|XXX|HACK):/i.test(codeContent)) {
                hasContent = true;
                break;
              }
            }

            if (line.includes('}')) {
              braceDepth--;
              if (braceDepth === 0 && foundOpenBrace) {
                if (!hasContent) return true; // Found empty catch
                break; // Exit search for this catch block
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
        const paramStr = match[1].trim();
        // Destructured object/array as single parameter — this is the recommended fix, not a problem
        if (paramStr.startsWith('{') || paramStr.startsWith('[')) return false;
        const params = paramStr.split(',').map(p => p.trim()).filter(p => p.length > 0);
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
