# Coding Conventions

**Analysis Date:** 2026-03-25

## Naming Patterns

**Files:**
- Modules use camelCase: `codeAnalysis.js`, `performanceRules.js`
- React components use PascalCase: `App.jsx`
- Old/alternate versions use suffix pattern: `App_old_flashy.jsx`
- Config/constants files: `constants.js`
- Barrel files: `index.js` (used in `src/rules/index.js` for rule aggregation)

**Functions:**
- Exported utility functions use camelCase: `cleanLines()`, `detectIndentSize()`, `nestingDepthFactory()`
- Factory pattern with "Factory" suffix: `nestingDepthFactory()` returns a function
- Predicate functions start with "has": `hasNestedLoops()`, `hasLinearScanInLoop()`
- Prefix helpers with "max" for aggregation: `maxLoopDepth()`
- Parse/fetch functions prefixed descriptively: `parseGitHubUrl()`, `fetchGitHubFile()`, `fetchGitHubRepoTree()`
- Calculate/analyze functions prefixed appropriately: `calculateImpactScore()`
- Rule test functions named `test()` within rule objects

**Variables:**
- camelCase for constants in code: `worstScore`, `loopDepth`, `inLoop`
- UPPERCASE_SNAKE_CASE only for config exports: `SEVERITY`, `COMPLEXITY_HIERARCHY`, `EXT_LANG`, `LANGUAGES`, `MAX_FILE_SIZE`
- Private/internal state with underscore prefix rarely used; favor clear descriptive names
- Loop counters use single letters: `i`, `j`, `k` (traditional)
- Accumulators/results: `flags`, `passed`, `results`, `counts`

**Types/Objects:**
- Object keys are camelCase: `{ bg, border, text, bar }` in severity colors
- Enums are UPPERCASE_SNAKE_CASE: `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`
- Rule objects have properties: `id` (kebab-case), `title` (Title Case), `severity`, `languages`, `test`, `message`, `hint`, `complexity`

**Rule IDs:**
- kebab-case for all rule identifiers: `"nested-loops"`, `"triple-nested-loops"`, `"linear-scan-in-loop"`, `"empty-catch"`

## Code Style

**Formatting:**
- No linter/formatter configured (no `.eslintrc*`, `.prettierrc`, or `eslint.config.*`)
- Spaces around operators and in object literals observed
- Indentation: 2 spaces (inferred from code and vite.config.js style)
- No semicolons enforced in many places, but generally present

**Linting:**
- No formal linting framework installed (vitest and prettier not in devDependencies)
- Comments use visual separators: `// ═══════════════════` for section breaks
- Inline comments use `//` with clear intent
- Block comments use `/* */` for multi-line explanations

**Visual Separators:**
- Heavy use of decorative comment lines using `═` characters to denote major sections:
  ```javascript
  // ═══════════════════════════════════════════════════════════════════════════════
  // RULE ENGINE — Pure local pattern matching, zero external dependencies
  // ═══════════════════════════════════════════════════════════════════════════════
  ```
- Lighter separators using `──` for subsections:
  ```javascript
  // ── Constants for EXT_LANG mapping ───────────────────────────────────────────
  ```

## Import Organization

**Order:**
1. React/Framework imports: `import React from 'react'`, `import { useState, ... } from 'react'`
2. Third-party libraries: `import { jsPDF } from 'jspdf'`, `import * as THREE from 'three'`
3. Local module imports: `import { RULES } from './rules/index.js'`
4. Config imports: `import { SEVERITY, ... } from './config/constants.js'`
5. Utility imports: `import { cleanLines, ... } from './utils/codeAnalysis.js'`

**Path Aliases:**
- Relative imports using `./` paths: `'./rules/index.js'`, `'./config/constants.js'`
- No path aliases configured in vite.config.js or package.json

**Module Exports:**
- Named exports for utility functions: `export const cleanLines = ...`
- Named exports for rule arrays: `export { performanceRules, aiSlopRules }`
- Combined export in aggregation files: `export const RULES = [...performanceRules, ...aiSlopRules]`
- Default exports used in React components: `export default App`

## Error Handling

**Patterns:**
- Try-catch blocks with silent failure in rule testing: `try { triggered = rule.test(...); } catch (_) {}`
- Underscore used to explicitly ignore caught errors
- Async errors handled with `.then()/.catch()` chaining in GitHub operations
- Error messages constructed with template literals: `` `GitHub API error: ${res.status} ${res.statusText}` ``
- Errors thrown with `new Error()`: `throw new Error('message')`
- Response validation before processing: `if (!res.ok) throw new Error(...)`
- Null/falsy checks with logical operators: `data.encoding === "base64"`, `!path || path.trim() === ""`

**Data Validation:**
- File extension detection and validation: `const ext = item.path.split('.').pop().toLowerCase()`
- Language mapping with fallback: `const language = EXT_LANG[ext] || 'javascript'`
- File size validation against limits: `MAX_FILE_SIZE`, `MAX_GITHUB_FILE_SIZE`, `MAX_REPO_FILES`
- Array filtering before processing: `.filter()` used extensively

## Logging

**Framework:** Native `console` methods (no logging library)

**Patterns:**
- Test runner uses `console.log()` for status output
- Progress reporting via callback: `onProgress && onProgress({ current: i + 1, total: files.length, file: file.path })`
- No production logging observed in main code (console use is test/development only)
- Debug output in test files with repeating separators: `console.log("=".repeat(80))`

## Comments

**When to Comment:**
- Function declarations use JSDoc-style blocks:
  ```javascript
  /**
   * Improved comment stripping that handles multi-line comments properly
   * @param {string[]} lines - Array of code lines
   * @returns {string[]} - Cleaned lines without comments
   */
  ```
- Section headers use decorative comment lines (see Visual Separators above)
- Complex logic receives inline explanations, especially regex patterns

**JSDoc/TSDoc:**
- Type annotations in doc blocks: `@param {string[]} lines`, `@returns {boolean}`
- Param descriptions included in JSDoc: `- Array of code lines`
- Return type and description in JSDoc

**Inline Comments:**
- Used to clarify intent: `// Like checking if two phone books have duplicates...`
- Explain "why" not "what": `// Rate limiting: small delay between requests`
- Mark edge cases: `// Check for inline empty catch` vs `// Check for multi-line empty catch blocks`

## Function Design

**Size:**
- Small, focused functions (20-40 lines typical)
- Longer analysis functions (50-100+ lines) in rule definition for complex pattern matching
- Factory pattern used to return configured functions: `nestingDepthFactory()` returns a closure

**Parameters:**
- Rule objects use consistent parameter names: `(lines, code, raw, nestingDepth)` for test functions
- Underscore prefix for unused parameters: `(_l, _c, raw, nestingDepth)` indicates intentional non-use
- Optional callbacks passed as params: `onProgress` is checked with `&&` before calling
- Signal parameter for AbortController: `async function(..., signal)` used in GitHub fetches

**Return Values:**
- Boolean returns for predicates: `hasNestedLoops()` → `true|false`
- Object returns for complex data: `parseGitHubUrl()` → `{ owner, repo, branch, path, isRepoUrl }`
- Array returns for collections: `cleanLines()` → `string[]`
- Early returns for guard clauses: `if (!match) return null;`
- Chained returns in nested ternaries used occasionally for brevity

## Module Design

**Exports:**
- Files export only what's needed for consumption
- Index files aggregate related exports: `src/rules/index.js` re-exports `performanceRules` and `aiSlopRules`
- Constants file exports configuration: `src/config/constants.js`
- Utilities file exports helper functions: `src/utils/codeAnalysis.js`

**Barrel Files:**
- Used in `src/rules/index.js`: combines `performanceRules` and `aiSlopRules` into single `RULES` array
- Allows importing rules from one location: `import { RULES } from './rules/index.js'`

**Separation of Concerns:**
- Rules separated by type: `performanceRules.js` (18 rules) vs `aiSlopRules.js` (7 rules)
- Analysis utilities in `codeAnalysis.js` (helper functions)
- Examples and explanations in separate files: `examples.js`, `beginnerExplanations.js`
- Constants centralized in `config/constants.js`

---

*Convention analysis: 2026-03-25*
