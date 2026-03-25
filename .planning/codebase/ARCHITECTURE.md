# Architecture

**Analysis Date:** 2026-03-25

## Pattern Overview

**Overall:** Layered, rule-engine architecture with separation of concerns across configuration, analysis logic, UI presentation, and utilities.

**Key Characteristics:**
- Pure functional analysis engine with zero external API dependencies
- Rule-driven pattern matching for code quality inspection
- Modular rule registry supporting 25 distinct analysis rules
- React-based UI layer with interactive code editor
- Exportable PDF reports with visual severity scoring

## Layers

**UI/Presentation Layer:**
- Purpose: Interactive code input, real-time results display, PDF export, example switching
- Location: `src/App.jsx`, `src/main.jsx`, `index.html`
- Contains: React components, state management (useState, useRef), Vanta.js background animation, jsPDF generation
- Depends on: Analysis engine, rule registry, examples, explanations
- Used by: End users via browser

**Analysis Engine (Core Logic):**
- Purpose: Execute rule matching against submitted code, aggregate findings, calculate impact scores
- Location: `src/App.jsx` (function `runAnalysis`)
- Contains: Rule execution loop, line normalization, complexity calculation, severity mapping
- Depends on: RULES registry, helper utilities, code analysis functions
- Used by: UI layer to process user input

**Rule Registry & Engine:**
- Purpose: Centralized definition and export of all analysis rules
- Location: `src/rules/index.js`, `src/rules/performanceRules.js`, `src/rules/aiSlopRules.js`
- Contains: 18 performance rules, 7 AI slop detection rules, rule metadata (id, severity, test function, messaging)
- Depends on: Code analysis utilities (helpers for loop detection, recursion, etc.)
- Used by: Analysis engine during rule execution

**Configuration Layer:**
- Purpose: Define constants, severity mappings, color schemes, language support, file size limits
- Location: `src/config/constants.js`
- Contains: SEVERITY levels, COMPLEXITY_HIERARCHY, language mappings, default code placeholder, timeout settings
- Depends on: None
- Used by: Analysis engine, UI layer, constants throughout app

**Utility/Helper Functions:**
- Purpose: Parse code structure, detect indentation, analyze nesting depth, provide beginner explanations
- Location: `src/utils/codeAnalysis.js`, `src/utils/beginnerExplanations.js`, `src/utils/examples.js`
- Contains: Line cleaning (comment removal), indentation detection, nesting depth factory, linear scan detection, fibonacci example data, beginner-friendly explanations for each rule
- Depends on: None (pure functions)
- Used by: Analysis engine, rule test functions, UI for explanations

## Data Flow

**Code Submission → Analysis → Results Display:**

1. User pastes code into `<textarea>` in `src/App.jsx`
2. User selects language and clicks "Analyze Code"
3. `runAnalysis(code, language)` is invoked:
   - Split code into lines via `.split("\n")`
   - Clean lines: `cleanLines(rawLines)` removes comments (single-line, multi-line)
   - For each rule in RULES array:
     - Call `rule.test(lines, code, raw, nestingDepthFactory)` with context
     - If true, add to `flags[]` array with rule metadata
     - If false, add to `passed[]` array
   - Calculate complexity score: sum of COMPLEXITY_HIERARCHY values for matched complexity rules
   - Build detailed results with severity colors and beginner explanations
4. Results render in `<div id="results">`:
   - Grouped by severity (CRITICAL, HIGH, MEDIUM, LOW)
   - Each flag shows title, message, hint, complexity impact
   - Beginner explanation toggle via `calculateImpactScore()`
5. User can export PDF via jsPDF or try example codes

**State Management:**
- `const [code, setCode]` — user's submitted code text
- `const [language, setLanguage]` — selected programming language
- `const [results, setResults]` — analyzed output (flags array, passed rules, complexity score)
- `const [selectedExample, setSelectedExample]` — tracks active example code
- Vanta animation maintained via `useRef(vantaEffect)`

## Key Abstractions

**Rule Object:**
- Purpose: Encapsulates single analysis pattern with metadata and test logic
- Examples: `src/rules/performanceRules.js` (nested-loops, triple-nested-loops, etc.), `src/rules/aiSlopRules.js` (empty-catch, missing-null-check)
- Pattern: `{ id, title, severity, languages, test(lines, code, raw, nestingDepth), message, hint, complexity }`
- Test function returns boolean; message and hint are user-facing strings

**Nesting Depth Factory:**
- Purpose: Stateful function that calculates brace/bracket depth for each line (used by rules to detect loop nesting)
- Example: `nestingDepth(line)` returns integer depth
- Used in: `linear-scan-in-loop`, `alloc-in-loop`, `sort-in-loop`, `async-in-loop` rule tests

**Code Cleaning Pipeline:**
- Purpose: Normalize code for analysis by removing comments and whitespace
- Abstractions:
  - `cleanLines(lines)` — removes single-line (`//`, `#`) and multi-line (`/* */`) comments
  - `detectIndentSize(lines)` — returns indent unit (tabs=1, spaces=2/4)
- Used by: Analysis engine before rule execution

**Result Aggregation:**
- Purpose: Collect flagged rules with severity, complexity scores, and explanations
- Data: `{ flags: [...], passed: [...], complexityScore: number, totalScore: number }`
- Grouped and colored in UI by severity level

## Entry Points

**Browser Entry:**
- Location: `index.html`
- Triggers: Page load in browser
- Responsibilities: Load React root and vite-compiled app

**React Root:**
- Location: `src/main.jsx`
- Triggers: `index.html` script tag
- Responsibilities: Mount `<App />` component to `#root` div

**Main App Component:**
- Location: `src/App.jsx`
- Triggers: React render
- Responsibilities: Render textarea, language selector, analyze button; manage state; call `runAnalysis()`; display results; handle PDF export and example switching

## Error Handling

**Strategy:** Defensive pattern matching with regex and string operations; no try-catch blocks in analysis engine (pure functions). Validation at UI boundary.

**Patterns:**
- Rule test functions return boolean (no exceptions thrown)
- Code parsing assumes valid input; invalid syntax is handled gracefully (rules still execute)
- File size validation in UI before analysis (MAX_FILE_SIZE = 5MB)
- Language detection via dropdown (no auto-detection errors)
- Empty catch blocks are detected by AI slop rules, not prevented

## Cross-Cutting Concerns

**Logging:** Console.log appears in examples and tests only; production code has no logging

**Validation:**
- Code size check before analysis
- Language selection enforced via dropdown (LANGUAGES constant)
- File encoding assumed UTF-8

**Internationalization:** Not implemented; all messages in English

---

*Architecture analysis: 2026-03-25*
