<!-- GSD:project-start source:PROJECT.md -->
## Project

**Code Efficiency Checker**

A browser-based static analysis tool that detects performance anti-patterns and algorithmic inefficiencies across 10 programming languages. It runs entirely client-side with no backend, no signup, and no data transmission — paste code, click analyze, get instant results. Targeted at students using AI-generated code and developers doing quick pre-PR sanity checks.

**Core Value:** Students paste code and immediately know what's inefficient and why — in plain language, with fixes they can act on.

### Constraints

- **Architecture:** Browser-only — all analysis must run in client JS. No Node.js backend.
- **Privacy:** Code never leaves the browser. Non-negotiable constraint.
- **GitHub rate limit:** 60 unauthenticated requests/hour — no workaround without auth flow.
- **Bundle size:** jsPDF added 372KB. New dependencies require justification and lazy-loading where possible.
- **Stack:** React 18 + Vite 7 + JavaScript (no TypeScript migration in v1/v2 scope).
- **Parser:** Regex-based only for now. No AST parsers — complexity budget constraint.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- JavaScript (ES6+) - Client-side application logic and UI
- JSX - React component definitions in `src/App.jsx`, `src/main.jsx`
- None - No backend server or additional language layers
## Runtime
- Node.js (version not explicitly specified, recommended 16+)
- npm
- Lockfile: `package-lock.json` (tracked in .gitignore - generated at install)
## Frameworks
- React 18.2.0 - UI framework for component-based interface
- Vite 7.3.1 - Build tool and dev server
- Three.js 0.160.0 - 3D graphics library (used by Vanta background)
- Vanta 0.5.24 - Background animation effects, specifically `vanta.topology` module
- jsPDF 2.5.2 - PDF generation for exporting analysis results
- @vitejs/plugin-react 4.2.1 - React JSX transformation for Vite
## Key Dependencies
- react - 18.2.0 - Core UI framework, required for component rendering
- vite - 7.3.1 - Build system and dev server (dev dependency)
- three - 0.160.0 - Required peer dependency for vanta.js animations
- vanta - 0.5.24 - Animated background visualization effect
- jspdf - 2.5.2 - Enables PDF export functionality for analysis reports
- @vitejs/plugin-react - 4.2.1 - Enables JSX transformation during builds
## Configuration
- No environment variables required for core functionality
- .env files are gitignored but not required for operation
- Configuration constants defined in `src/config/constants.js`:
- `vite.config.js` - Single configuration file with React plugin enabled
- Module type: "module" (ES6 modules)
- Build output: `dist/` directory (generated, not committed)
## Platform Requirements
- Node.js 16+ (for npm and ES6+ support)
- Modern terminal with bash compatibility
- No database or backend server required
- Modern browser with ES6+ support (Chrome, Firefox, Safari, Edge - latest versions)
- No server-side deployment needed
- Static file hosting capability (any HTTP server can serve the `dist/` output)
- Web APIs required: File API, Fetch API, localStorage (if offline persistence added)
## Entry Points
- `index.html` - Static HTML entry point
- `src/main.jsx` - React application mount point
- `src/App.jsx` - Main application component (1175 lines, contains rule engine and UI)
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- Modules use camelCase: `codeAnalysis.js`, `performanceRules.js`
- React components use PascalCase: `App.jsx`
- Old/alternate versions use suffix pattern: `App_old_flashy.jsx`
- Config/constants files: `constants.js`
- Barrel files: `index.js` (used in `src/rules/index.js` for rule aggregation)
- Exported utility functions use camelCase: `cleanLines()`, `detectIndentSize()`, `nestingDepthFactory()`
- Factory pattern with "Factory" suffix: `nestingDepthFactory()` returns a function
- Predicate functions start with "has": `hasNestedLoops()`, `hasLinearScanInLoop()`
- Prefix helpers with "max" for aggregation: `maxLoopDepth()`
- Parse/fetch functions prefixed descriptively: `parseGitHubUrl()`, `fetchGitHubFile()`, `fetchGitHubRepoTree()`
- Calculate/analyze functions prefixed appropriately: `calculateImpactScore()`
- Rule test functions named `test()` within rule objects
- camelCase for constants in code: `worstScore`, `loopDepth`, `inLoop`
- UPPERCASE_SNAKE_CASE only for config exports: `SEVERITY`, `COMPLEXITY_HIERARCHY`, `EXT_LANG`, `LANGUAGES`, `MAX_FILE_SIZE`
- Private/internal state with underscore prefix rarely used; favor clear descriptive names
- Loop counters use single letters: `i`, `j`, `k` (traditional)
- Accumulators/results: `flags`, `passed`, `results`, `counts`
- Object keys are camelCase: `{ bg, border, text, bar }` in severity colors
- Enums are UPPERCASE_SNAKE_CASE: `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`
- Rule objects have properties: `id` (kebab-case), `title` (Title Case), `severity`, `languages`, `test`, `message`, `hint`, `complexity`
- kebab-case for all rule identifiers: `"nested-loops"`, `"triple-nested-loops"`, `"linear-scan-in-loop"`, `"empty-catch"`
## Code Style
- No linter/formatter configured (no `.eslintrc*`, `.prettierrc`, or `eslint.config.*`)
- Spaces around operators and in object literals observed
- Indentation: 2 spaces (inferred from code and vite.config.js style)
- No semicolons enforced in many places, but generally present
- No formal linting framework installed (vitest and prettier not in devDependencies)
- Comments use visual separators: `// ═══════════════════` for section breaks
- Inline comments use `//` with clear intent
- Block comments use `/* */` for multi-line explanations
- Heavy use of decorative comment lines using `═` characters to denote major sections:
- Lighter separators using `──` for subsections:
## Import Organization
- Relative imports using `./` paths: `'./rules/index.js'`, `'./config/constants.js'`
- No path aliases configured in vite.config.js or package.json
- Named exports for utility functions: `export const cleanLines = ...`
- Named exports for rule arrays: `export { performanceRules, aiSlopRules }`
- Combined export in aggregation files: `export const RULES = [...performanceRules, ...aiSlopRules]`
- Default exports used in React components: `export default App`
## Error Handling
- Try-catch blocks with silent failure in rule testing: `try { triggered = rule.test(...); } catch (_) {}`
- Underscore used to explicitly ignore caught errors
- Async errors handled with `.then()/.catch()` chaining in GitHub operations
- Error messages constructed with template literals: `` `GitHub API error: ${res.status} ${res.statusText}` ``
- Errors thrown with `new Error()`: `throw new Error('message')`
- Response validation before processing: `if (!res.ok) throw new Error(...)`
- Null/falsy checks with logical operators: `data.encoding === "base64"`, `!path || path.trim() === ""`
- File extension detection and validation: `const ext = item.path.split('.').pop().toLowerCase()`
- Language mapping with fallback: `const language = EXT_LANG[ext] || 'javascript'`
- File size validation against limits: `MAX_FILE_SIZE`, `MAX_GITHUB_FILE_SIZE`, `MAX_REPO_FILES`
- Array filtering before processing: `.filter()` used extensively
## Logging
- Test runner uses `console.log()` for status output
- Progress reporting via callback: `onProgress && onProgress({ current: i + 1, total: files.length, file: file.path })`
- No production logging observed in main code (console use is test/development only)
- Debug output in test files with repeating separators: `console.log("=".repeat(80))`
## Comments
- Function declarations use JSDoc-style blocks:
- Section headers use decorative comment lines (see Visual Separators above)
- Complex logic receives inline explanations, especially regex patterns
- Type annotations in doc blocks: `@param {string[]} lines`, `@returns {boolean}`
- Param descriptions included in JSDoc: `- Array of code lines`
- Return type and description in JSDoc
- Used to clarify intent: `// Like checking if two phone books have duplicates...`
- Explain "why" not "what": `// Rate limiting: small delay between requests`
- Mark edge cases: `// Check for inline empty catch` vs `// Check for multi-line empty catch blocks`
## Function Design
- Small, focused functions (20-40 lines typical)
- Longer analysis functions (50-100+ lines) in rule definition for complex pattern matching
- Factory pattern used to return configured functions: `nestingDepthFactory()` returns a closure
- Rule objects use consistent parameter names: `(lines, code, raw, nestingDepth)` for test functions
- Underscore prefix for unused parameters: `(_l, _c, raw, nestingDepth)` indicates intentional non-use
- Optional callbacks passed as params: `onProgress` is checked with `&&` before calling
- Signal parameter for AbortController: `async function(..., signal)` used in GitHub fetches
- Boolean returns for predicates: `hasNestedLoops()` → `true|false`
- Object returns for complex data: `parseGitHubUrl()` → `{ owner, repo, branch, path, isRepoUrl }`
- Array returns for collections: `cleanLines()` → `string[]`
- Early returns for guard clauses: `if (!match) return null;`
- Chained returns in nested ternaries used occasionally for brevity
## Module Design
- Files export only what's needed for consumption
- Index files aggregate related exports: `src/rules/index.js` re-exports `performanceRules` and `aiSlopRules`
- Constants file exports configuration: `src/config/constants.js`
- Utilities file exports helper functions: `src/utils/codeAnalysis.js`
- Used in `src/rules/index.js`: combines `performanceRules` and `aiSlopRules` into single `RULES` array
- Allows importing rules from one location: `import { RULES } from './rules/index.js'`
- Rules separated by type: `performanceRules.js` (18 rules) vs `aiSlopRules.js` (7 rules)
- Analysis utilities in `codeAnalysis.js` (helper functions)
- Examples and explanations in separate files: `examples.js`, `beginnerExplanations.js`
- Constants centralized in `config/constants.js`
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- Pure functional analysis engine with zero external API dependencies
- Rule-driven pattern matching for code quality inspection
- Modular rule registry supporting 25 distinct analysis rules
- React-based UI layer with interactive code editor
- Exportable PDF reports with visual severity scoring
## Layers
- Purpose: Interactive code input, real-time results display, PDF export, example switching
- Location: `src/App.jsx`, `src/main.jsx`, `index.html`
- Contains: React components, state management (useState, useRef), Vanta.js background animation, jsPDF generation
- Depends on: Analysis engine, rule registry, examples, explanations
- Used by: End users via browser
- Purpose: Execute rule matching against submitted code, aggregate findings, calculate impact scores
- Location: `src/App.jsx` (function `runAnalysis`)
- Contains: Rule execution loop, line normalization, complexity calculation, severity mapping
- Depends on: RULES registry, helper utilities, code analysis functions
- Used by: UI layer to process user input
- Purpose: Centralized definition and export of all analysis rules
- Location: `src/rules/index.js`, `src/rules/performanceRules.js`, `src/rules/aiSlopRules.js`
- Contains: 18 performance rules, 7 AI slop detection rules, rule metadata (id, severity, test function, messaging)
- Depends on: Code analysis utilities (helpers for loop detection, recursion, etc.)
- Used by: Analysis engine during rule execution
- Purpose: Define constants, severity mappings, color schemes, language support, file size limits
- Location: `src/config/constants.js`
- Contains: SEVERITY levels, COMPLEXITY_HIERARCHY, language mappings, default code placeholder, timeout settings
- Depends on: None
- Used by: Analysis engine, UI layer, constants throughout app
- Purpose: Parse code structure, detect indentation, analyze nesting depth, provide beginner explanations
- Location: `src/utils/codeAnalysis.js`, `src/utils/beginnerExplanations.js`, `src/utils/examples.js`
- Contains: Line cleaning (comment removal), indentation detection, nesting depth factory, linear scan detection, fibonacci example data, beginner-friendly explanations for each rule
- Depends on: None (pure functions)
- Used by: Analysis engine, rule test functions, UI for explanations
## Data Flow
- `const [code, setCode]` — user's submitted code text
- `const [language, setLanguage]` — selected programming language
- `const [results, setResults]` — analyzed output (flags array, passed rules, complexity score)
- `const [selectedExample, setSelectedExample]` — tracks active example code
- Vanta animation maintained via `useRef(vantaEffect)`
## Key Abstractions
- Purpose: Encapsulates single analysis pattern with metadata and test logic
- Examples: `src/rules/performanceRules.js` (nested-loops, triple-nested-loops, etc.), `src/rules/aiSlopRules.js` (empty-catch, missing-null-check)
- Pattern: `{ id, title, severity, languages, test(lines, code, raw, nestingDepth), message, hint, complexity }`
- Test function returns boolean; message and hint are user-facing strings
- Purpose: Stateful function that calculates brace/bracket depth for each line (used by rules to detect loop nesting)
- Example: `nestingDepth(line)` returns integer depth
- Used in: `linear-scan-in-loop`, `alloc-in-loop`, `sort-in-loop`, `async-in-loop` rule tests
- Purpose: Normalize code for analysis by removing comments and whitespace
- Abstractions:
- Used by: Analysis engine before rule execution
- Purpose: Collect flagged rules with severity, complexity scores, and explanations
- Data: `{ flags: [...], passed: [...], complexityScore: number, totalScore: number }`
- Grouped and colored in UI by severity level
## Entry Points
- Location: `index.html`
- Triggers: Page load in browser
- Responsibilities: Load React root and vite-compiled app
- Location: `src/main.jsx`
- Triggers: `index.html` script tag
- Responsibilities: Mount `<App />` component to `#root` div
- Location: `src/App.jsx`
- Triggers: React render
- Responsibilities: Render textarea, language selector, analyze button; manage state; call `runAnalysis()`; display results; handle PDF export and example switching
## Error Handling
- Rule test functions return boolean (no exceptions thrown)
- Code parsing assumes valid input; invalid syntax is handled gracefully (rules still execute)
- File size validation in UI before analysis (MAX_FILE_SIZE = 5MB)
- Language detection via dropdown (no auto-detection errors)
- Empty catch blocks are detected by AI slop rules, not prevented
## Cross-Cutting Concerns
- Code size check before analysis
- Language selection enforced via dropdown (LANGUAGES constant)
- File encoding assumed UTF-8
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
