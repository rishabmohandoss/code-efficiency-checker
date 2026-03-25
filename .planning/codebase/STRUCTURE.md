# Codebase Structure

**Analysis Date:** 2026-03-25

## Directory Layout

```
code-efficiency-checker/
├── .planning/
│   └── codebase/              # GSD planning documents (auto-generated)
├── .git/                       # Version control
├── src/
│   ├── App.jsx                # Main React component (1175 lines)
│   ├── App_old_flashy.jsx     # Legacy UI version (archived)
│   ├── main.jsx               # Entry point (8 lines)
│   ├── config/
│   │   └── constants.js       # Global config (severity, complexity, limits)
│   ├── rules/
│   │   ├── index.js           # Rule registry (exports RULES array)
│   │   ├── performanceRules.js # 18 algorithmic efficiency rules
│   │   └── aiSlopRules.js     # 7 AI-generated code detection rules
│   └── utils/
│       ├── codeAnalysis.js    # Code parsing helpers (nesting depth, indent detection)
│       ├── beginnerExplanations.js # User-friendly explanations for each rule
│       └── examples.js        # Pre-filled code samples for "Try Example"
├── tests/
│   └── analyzer.test.js       # Test suite for analysis engine
├── index.html                 # HTML root (loads React app)
├── vite.config.js             # Vite build configuration
├── package.json               # Dependencies (React, jsPDF, Three.js, Vanta)
├── README.md                  # Project overview
└── [doc files]                # ARCHITECTURE.md, FEATURES_IMPLEMENTED.md, etc.
```

## Directory Purposes

**`src/`:**
- Purpose: All application source code
- Contains: React components, analysis engine, rules, utilities, configuration
- Key files: `App.jsx` (main UI and analysis), `rules/` (all 25 rules), `utils/` (helpers)

**`src/config/`:**
- Purpose: Centralized configuration and constants
- Contains: Severity definitions, color schemes, language mappings, file size limits, timeout values
- Key files: `constants.js`

**`src/rules/`:**
- Purpose: Modular rule definitions for code analysis
- Contains: Two rule categories (performance, AI slop) with 25 total rules
- Key files: `index.js` (registry), `performanceRules.js` (18 rules), `aiSlopRules.js` (7 rules)

**`src/utils/`:**
- Purpose: Pure utility functions and helper data
- Contains: Code parsing (line cleaning, indentation, nesting depth), beginner explanations, example code snippets
- Key files: `codeAnalysis.js` (parsing), `beginnerExplanations.js` (UI text), `examples.js` (sample code)

**`tests/`:**
- Purpose: Unit and integration test suite
- Contains: Test cases covering all rule types and edge cases
- Key files: `analyzer.test.js` (226 lines, comprehensive test suite)

**`.planning/codebase/`:**
- Purpose: GSD-generated analysis documents (auto-created)
- Contains: ARCHITECTURE.md, STRUCTURE.md, CONVENTIONS.md, TESTING.md, CONCERNS.md, STACK.md, INTEGRATIONS.md
- Generated: Yes
- Committed: Yes

## Key File Locations

**Entry Points:**
- `index.html`: HTML page that loads the Vite bundle
- `src/main.jsx`: React app entry point (mounts App to #root)
- `src/App.jsx`: Main React component (analysis UI and state management)

**Configuration:**
- `src/config/constants.js`: Global constants (severity levels, colors, language mappings)
- `vite.config.js`: Build configuration (React plugin)
- `package.json`: Dependencies and dev scripts

**Core Logic:**
- `src/App.jsx`: Analysis engine (function `runAnalysis(code, language)`)
- `src/rules/index.js`: Rule registry (RULES array)
- `src/rules/performanceRules.js`: Performance-focused analysis rules
- `src/rules/aiSlopRules.js`: AI-generated code detection rules

**Utilities:**
- `src/utils/codeAnalysis.js`: Parsing helpers (cleanLines, detectIndentSize, nestingDepth factory)
- `src/utils/beginnerExplanations.js`: Simple explanations for each rule
- `src/utils/examples.js`: Pre-filled code examples

**Testing:**
- `tests/analyzer.test.js`: Test suite for analysis engine and all rules
- `test-ai-slop.js`: Ad-hoc AI slop detection testing
- `test-sample.js`: Basic test harness
- `student-vibecheck-test.js`: Student code analysis examples

## Naming Conventions

**Files:**
- React components: PascalCase with `.jsx` extension (`App.jsx`, `App_old_flashy.jsx`)
- Utilities: camelCase with `.js` extension (`codeAnalysis.js`, `beginnerExplanations.js`)
- Rule modules: descriptive camelCase (`performanceRules.js`, `aiSlopRules.js`)
- Test files: suffix `.test.js` or prefix `test-` (`analyzer.test.js`, `test-ai-slop.js`)
- Config: explicit naming (`constants.js`, `vite.config.js`)

**Directories:**
- Feature grouping: lowercase plural (`src/rules/`, `src/utils/`, `src/config/`)
- Architecture grouping: descriptive and clear (`src/`, `tests/`, `.planning/codebase/`)

**Inside code:**
- Rule object keys: camelCase with hyphens in ids (`nested-loops`, `empty-catch`)
- Function names: camelCase (`runAnalysis`, `cleanLines`, `detectIndentSize`)
- Constants: UPPERCASE_WITH_UNDERSCORES (`MAX_FILE_SIZE`, `GITHUB_TIMEOUT`)
- React state: camelCase (`code`, `language`, `results`, `selectedExample`)

## Where to Add New Code

**New Rule (Performance or AI Slop):**
- Add to appropriate file:
  - Performance rule → `src/rules/performanceRules.js`
  - AI slop rule → `src/rules/aiSlopRules.js`
- Rule object structure: `{ id, title, severity, languages, test(lines, code, raw, nestingDepth), message, hint, complexity }`
- Export from rule file, import in `src/rules/index.js`, add to RULES array
- Add beginner explanation to `src/utils/beginnerExplanations.js` with key matching rule.id

**New Utility Function:**
- Parse logic → `src/utils/codeAnalysis.js` (export as named export)
- User-facing text → `src/utils/beginnerExplanations.js` (add to BEGINNER_EXPLANATIONS object)
- Example code → `src/utils/examples.js` (add to EXAMPLES object)

**New Configuration:**
- Global constant → `src/config/constants.js` (export as named export)
- Severity definition → update SEVERITY_COLORS object in `constants.js`

**New Component or Feature:**
- UI feature in `src/App.jsx` (single file, 1175 lines, monolithic component)
- State management via useState hooks in App.jsx
- No separate component files currently used

**Tests:**
- Add test case to `tests/analyzer.test.js`
- Use testCases object structure: `{ code, expectedFlags, language }`
- Run with npm test (uses vitest framework per package.json)

## Special Directories

**`node_modules/`:**
- Purpose: Installed npm dependencies
- Generated: Yes (npm install)
- Committed: No (.gitignore excludes)

**`.git/`:**
- Purpose: Version control repository
- Generated: Yes (git init)
- Committed: Yes (git folder itself)

**`.planning/codebase/`:**
- Purpose: GSD analysis documents (ARCHITECTURE.md, STRUCTURE.md, etc.)
- Generated: Yes (auto-generated by /gsd:map-codebase)
- Committed: Yes (tracked in git)

## Build & Development Workflow

**Development:**
```bash
npm install              # Install dependencies (React, Vite, etc.)
npm run dev             # Start Vite dev server (http://localhost:5173)
```

**Production:**
```bash
npm run build           # Build to dist/ (Vite compiles JSX, minifies)
npm run preview         # Preview production build locally
```

**Testing:**
```bash
npm test                # Run test suite (analyzer.test.js via vitest)
```

**Code Flow in Development:**
1. User edits code in textarea in `src/App.jsx`
2. Vite HMR reloads component on save
3. User clicks "Analyze Code" → `runAnalysis(code, language)` executes
4. Results update in-place in DOM

---

*Structure analysis: 2026-03-25*
