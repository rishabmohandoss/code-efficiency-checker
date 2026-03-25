# Testing Patterns

**Analysis Date:** 2026-03-25

## Test Framework

**Runner:**
- Vitest (recommended but not installed)
- Config file: None currently; `vite.config.js` exists for build but has no test configuration
- No test runner currently active; tests defined but not executable

**Assertion Library:**
- No assertion library installed (would use Vitest's built-in or chai if needed)

**Run Commands:**
```bash
npm test              # Currently returns placeholder message directing to vitest installation
npm install -D vitest # Required first step
npm test              # After vitest installed (requires package.json updates)
```

**Current Status:**
- `package.json` script: `"test": "echo \"Tests are defined in tests/analyzer.test.js. Install vitest to run them: npm install -D vitest\" && exit 0"`
- Tests defined but framework not installed
- No vitest configuration file present

## Test File Organization

**Location:**
- Main test file: `tests/analyzer.test.js`
- Additional manual test files in root: `test-sample.js`, `test-ai-slop.js`, `student-vibecheck-test.js`
- Test files are co-located in dedicated `tests/` directory (one per concern)

**Naming:**
- Pattern: `[concern].test.js` for formal tests
- Pattern: `[context]-test.js` for manual/ad-hoc test files in root
- Examples: `analyzer.test.js`, `student-vibecheck-test.js`, `test-ai-slop.js`

**Structure:**
```
tests/
├── analyzer.test.js          # Main test suite (25+ test cases)
student-vibecheck-test.js     # Manual testing with realistic AI-generated code
test-ai-slop.js               # Focused AI slop detection tests
test-sample.js                # Basic sanity checks
```

## Test Structure

**Suite Organization:**
```javascript
const testCases = {
  nestedLoops: {
    code: `function findDuplicates(arr) { ... }`,
    expectedFlags: ["nested-loops"],
    language: "javascript"
  },
  tripleNestedLoops: {
    code: `for (let i = 0; i < n; i++) { ... }`,
    expectedFlags: ["triple-nested-loops", "console-in-loop"],
    language: "javascript"
  },
  // ... more test cases
};
```

**Test Case Structure:**
- Key: camelCase test name (e.g., `nestedLoops`, `tripleNestedLoops`)
- `code`: String containing code sample to analyze
- `expectedFlags`: Array of rule IDs expected to trigger (e.g., `["nested-loops"]`)
- `language`: Target language for analysis (e.g., `"javascript"`, `"python"`)

**Patterns:**
- No setUp/tearDown observed (data-driven approach)
- No mocking framework in use
- Test isolation via independent test case objects
- No test fixtures or factories currently (test data embedded inline)

## Mocking

**Framework:** Not used currently

**Patterns:**
- No mocks or stubs in test suite
- GitHub API calls would need mocking (AbortController pattern in place for timeout testing)
- Dependencies imported directly, no dependency injection

**What to Mock (when needed):**
- `fetch()` calls for GitHub API: Create mock responses for `fetchGitHubFile()`, `fetchGitHubRepoTree()`
- File system operations: Not applicable (pure code analysis)
- `AbortController.signal`: For timeout testing in async operations

**What NOT to Mock:**
- Core analysis functions: `runAnalysis()`, `cleanLines()`, `hasNestedLoops()` — test real implementations
- Rule definitions and pattern matching — test actual regex behavior
- Rule registry (`RULES` array) — use actual rule definitions

## Fixtures and Factories

**Test Data:**
```javascript
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

  pythonNestedComprehension: {
    code: `matrix = [[j for j in range(cols)] for i in range(rows)]`,
    expectedFlags: ["python-nested-comprehension"],
    language: "python"
  }
};
```

**Location:**
- `tests/analyzer.test.js`: 19+ test cases with embedded code samples
- `student-vibecheck-test.js`: Realistic AI-generated code patterns for integration testing
- `test-ai-slop.js`: Focused test cases for AI slop rules
- No separate fixture files; data embedded in test cases

**Test Data Categories:**
1. **Core Performance Rules**: `nestedLoops`, `tripleNestedLoops`, `linearScanInLoop`, `allocInLoop`, `unboundedRecursion`, `sortInLoop`, `asyncInLoop`, `domInLoop`, `arrayAsSet`, `stringConcatLoop`
2. **Clean Code**: `cleanCode` (expects zero flags)
3. **Comment Handling**: `multiLineComments` (verifies comment stripping)
4. **Indentation Variants**: `indentationTabs`, `indentation4Spaces` (test indent detection)
5. **Language-Specific**: `pythonNestedComprehension`, `pythonAppendLoop`, `pythonKeysIteration`, `pythonInListLiteral`

## Coverage

**Requirements:** Not enforced (no coverage tool configured)

**View Coverage:** Not available without vitest and coverage plugin

**Current State:**
- 19 test cases defined in `analyzer.test.js`
- Coverage targets: All 25 rules (18 performance + 7 AI slop detection)
- Missing from formal test suite: Many AI slop rules (empty-catch, missing-null-check, infinite-loop, excessive-params, callback-hell, globals-pollution, var-leakage)

**Expected Coverage Gaps:**
- AI slop detection rules largely untested in formal suite
- Real GitHub API integration untested (would need mocking)
- Error cases and edge conditions partially covered

## Test Types

**Unit Tests:**
- Scope: Individual analysis functions and rule pattern matching
- Approach: Test each rule ID with specific code sample that should trigger it
- Examples: `nestedLoops`, `linearScanInLoop`, `unboundedRecursion`
- Pattern: Code sample → analyze → check `expectedFlags` array

**Integration Tests:**
- Scope: Full analysis pipeline with multiple rules
- Approach: Real code samples that trigger multiple rules simultaneously
- Examples: `tripleNestedLoops` (expects both `"triple-nested-loops"` and `"console-in-loop"`)
- Pattern: Complex code → `runAnalysis()` → validate multiple flags

**E2E Tests:**
- Framework: Not implemented
- Would cover: Full app flow (paste code → analyze → display results)
- Candidate: `student-vibecheck-test.js` provides realistic scenarios that could become E2E

## Common Patterns

**Async Testing:**
Not yet implemented (would require vitest setup)

```javascript
// Expected pattern when implemented:
test('async GitHub fetch', async () => {
  const results = await analyzeGitHubRepository(info, onProgress, signal);
  expect(results).toBeDefined();
});
```

**Error Testing:**
Not explicitly tested yet

```javascript
// Expected pattern when implemented:
test('handles invalid GitHub URL', () => {
  const result = parseGitHubUrl('not-a-github-url');
  expect(result).toBeNull();
});

test('handles API timeout', async () => {
  const controller = new AbortController();
  controller.abort();

  await expect(fetchGitHubFile(info, controller.signal))
    .rejects.toThrow();
});
```

**Test Execution Pattern (Current Manual):**
```javascript
console.log("=".repeat(80));
console.log("CODE EFFICIENCY CHECKER - TEST SUITE");
console.log("=".repeat(80));

console.log("\nTest cases defined:");
Object.keys(testCases).forEach(testName => {
  const test = testCases[testName];
  console.log(`  - ${testName}: expects ${test.expectedFlags.length} flag(s)`);
});

console.log("\n" + "=".repeat(80));
console.log("To run these tests:");
console.log("1. Install Vitest: npm install -D vitest");
console.log("2. Add to package.json scripts: \"test\": \"vitest\"");
console.log("3. Convert this file to use Vitest's test() and expect()");
console.log("4. Run: npm test");
console.log("=".repeat(80));
```

## Test Data Categories and Sample Coverage

**Performance Rules (18 total):**
- `nested-loops`: `nestedLoops` test ✓
- `triple-nested-loops`: `tripleNestedLoops` test ✓
- `linear-scan-in-loop`: `linearScanInLoop` test ✓
- `alloc-in-loop`: `allocInLoop` test ✓
- `unbounded-recursion`: `unboundedRecursion` test ✓
- `sort-in-loop`: `sortInLoop` test ✓
- `async-in-loop`: `asyncInLoop` test ✓
- `dom-in-loop`: `domInLoop` test ✓
- `array-as-set`: `arrayAsSet` test ✓
- `string-concat-loop`: `stringConcatLoop` test ✓
- `console-in-loop`: Covered in `tripleNestedLoops`, `indentationTabs`, `indentation4Spaces` ✓
- `python-nested-comprehension`: `pythonNestedComprehension` test ✓
- `python-append-loop`: `pythonAppendLoop` test ✓
- `python-keys-iteration`: `pythonKeysIteration` test ✓
- `python-in-list-literal`: `pythonInListLiteral` test ✓
- Others: Partially or not covered in formal tests

**AI Slop Rules (7 total):**
- `empty-catch`: No formal test (defined in `aiSlopRules.js`)
- `missing-null-check`: No formal test
- `infinite-loop`: No formal test
- `excessive-params`: No formal test
- `callback-hell`: No formal test
- `globals-pollution`: No formal test
- `var-leakage`: No formal test

**Edge Cases & Validation:**
- `cleanCode`: Expects zero flags (negative test) ✓
- `multiLineComments`: Tests comment stripping with nested loops ✓
- `indentationTabs`: Tests tab-based indentation detection ✓
- `indentation4Spaces`: Tests 4-space indentation detection ✓

---

*Testing analysis: 2026-03-25*
