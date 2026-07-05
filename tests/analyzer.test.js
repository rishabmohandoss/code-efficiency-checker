/**
 * Test Suite for Code Efficiency Checker (Vitest)
 * Run: npm test
 */
import { describe, test, expect } from 'vitest';
import { runAnalysis } from '../src/analysis/engine.js';
import { runSecurityAnalysis } from '../src/analysis/security-engine.js';

const testCases = {
  nestedLoops: {
    code: `function findDuplicates(arr) {
  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) {
      if (arr[i] === arr[j]) return true;
    }
  }
  return false;
}`,
    expectedFlags: ["nested-loops"],
    language: "javascript"
  },

  tripleNestedLoops: {
    code: `for (let i = 0; i < n; i++) {
  for (let j = 0; j < n; j++) {
    for (let k = 0; k < n; k++) {
      console.log(i, j, k);
    }
  }
}`,
    expectedFlags: ["triple-nested-loops", "console-in-loop"],
    language: "javascript"
  },

  linearScanInLoop: {
    code: `const result = [];
for (let item of items) {
  if (!result.includes(item)) {
    result.push(item);
  }
}`,
    expectedFlags: ["linear-scan-in-loop"],
    language: "javascript"
  },

  allocInLoop: {
    code: `for (let i = 0; i < n; i++) {
  const obj = new Object();
  const arr = [];
  obj.index = i;
  arr.push(obj);
}`,
    expectedFlags: ["alloc-in-loop"],
    language: "javascript"
  },

  unboundedRecursion: {
    code: `function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}`,
    expectedFlags: ["unbounded-recursion"],
    language: "javascript"
  },

  sortInLoop: {
    code: `for (let i = 0; i < items.length; i++) {
  items.sort((a, b) => a - b);
  console.log(items[0]);
}`,
    expectedFlags: ["sort-in-loop", "console-in-loop"],
    language: "javascript"
  },

  asyncInLoop: {
    code: `async function fetchAll(urls) {
  const results = [];
  for (let url of urls) {
    const data = await fetch(url);
    results.push(data);
  }
  return results;
}`,
    expectedFlags: ["async-in-loop"],
    language: "javascript"
  },

  domInLoop: {
    code: `for (let i = 0; i < items.length; i++) {
  const div = document.createElement('div');
  div.innerHTML = items[i];
  document.body.appendChild(div);
}`,
    expectedFlags: ["dom-in-loop"],
    language: "javascript"
  },

  arrayAsSet: {
    code: `const validValues = [1, 2, 3, 4, 5];
if (validValues.includes(userInput)) {
  console.log('Valid');
}`,
    expectedFlags: ["array-as-set"],
    language: "javascript"
  },

  stringConcatLoop: {
    code: `let result = '';
for (let i = 0; i < items.length; i++) {
  result += items[i] + ',';
}`,
    expectedFlags: ["string-concat-loop"],
    language: "javascript"
  },

  cleanCode: {
    code: `function findDuplicates(arr) {
  const seen = new Set();
  const dupes = new Set();

  for (let item of arr) {
    if (seen.has(item)) {
      dupes.add(item);
    } else {
      seen.add(item);
    }
  }

  return Array.from(dupes);
}`,
    expectedFlags: [],
    language: "javascript"
  },

  multiLineComments: {
    code: `/* This is a
   multi-line comment
   that should be stripped */
function test() {
  for (let i = 0; i < n; i++) {
    // This is a single line comment
    for (let j = 0; j < n; j++) {
      console.log(i, j);
    }
  }
}`,
    expectedFlags: ["nested-loops", "console-in-loop"],
    language: "javascript"
  },

  indentationTabs: {
    code: `function test() {
\tfor (let i = 0; i < n; i++) {
\t\tfor (let j = 0; j < n; j++) {
\t\t\tconsole.log(i, j);
\t\t}
\t}
}`,
    expectedFlags: ["nested-loops", "console-in-loop"],
    language: "javascript"
  },

  indentation4Spaces: {
    code: `function test() {
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            console.log(i, j);
        }
    }
}`,
    expectedFlags: ["nested-loops", "console-in-loop"],
    language: "javascript"
  },

  pythonNestedComprehension: {
    code: `matrix = [[j for j in range(cols)] for i in range(rows)]`,
    expectedFlags: ["python-nested-comprehension"],
    language: "python"
  },

  pythonAppendLoop: {
    code: `result = []
for item in items:
    result.append(item * 2)`,
    expectedFlags: ["python-append-loop"],
    language: "python"
  },

  pythonKeysIteration: {
    code: `for key in my_dict.keys():
    print(key)`,
    expectedFlags: ["python-keys-iteration"],
    language: "python"
  },

  pythonInListLiteral: {
    code: `if value in [1, 2, 3, 4, 5]:
    print("Valid")`,
    expectedFlags: ["python-in-list-literal"],
    language: "python"
  }
};

describe('performance rule engine', () => {
  Object.entries(testCases).forEach(([name, tc]) => {
    test(name, () => {
      const result = runAnalysis(tc.code, tc.language);
      const firedIds = result.flags.map(f => f.id);
      tc.expectedFlags.forEach(id => {
        expect(firedIds, `expected rule "${id}" to fire`).toContain(id);
      });
      if (tc.expectedFlags.length === 0) {
        expect(firedIds).toEqual([]);
      }
    });
  });
});

describe('security engine regressions', () => {
  test('flags every occurrence of a repeated secret (stateful /g regex bug)', () => {
    // Before the safeTest fix, reused /g regexes carried lastIndex across
    // lines and silently skipped every other identical match.
    const code = 'password = "hunter2"\npassword = "hunter2"\npassword = "hunter2"';
    const result = runSecurityAnalysis(code, 'javascript');
    expect(result.stats.critical).toBe(3);
  });

  test('detects an AWS access key', () => {
    const code = 'const key = "AKIAIOSFODNN7EXAMPLE";';
    const result = runSecurityAnalysis(code, 'javascript');
    expect(result.allIssues.some(i => i.id === 'hardcoded-api-key')).toBe(true);
  });

  test('clean code produces no critical issues', () => {
    const code = 'const key = process.env.API_KEY;\nconsole.log("ok");';
    const result = runSecurityAnalysis(code, 'javascript');
    expect(result.stats.critical).toBe(0);
  });
});
