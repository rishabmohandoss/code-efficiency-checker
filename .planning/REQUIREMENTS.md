# Requirements: Code Efficiency Checker

**Defined:** 2026-03-25
**Core Value:** Students paste code and immediately know what's inefficient and why — in plain language, with fixes they can act on.

## v1 Requirements

Requirements for this development milestone (brownfield — building on existing shipped v1).

### Codebase Health

- [ ] **HLTH-01**: Remove dead file `src/App_old_flashy.jsx` (1055 lines, never imported)
- [ ] **HLTH-02**: Fix silent error swallowing in rule execution — replace `catch (_) {}` with logged error including rule.id
- [ ] **HLTH-03**: Fix `cleanLines` comment stripping to preserve URL-like patterns inside string literals (e.g., `"http://example.com"`)
- [ ] **HLTH-04**: Hoist regex patterns to module-level constants across `performanceRules.js` and `aiSlopRules.js`
- [ ] **HLTH-05**: Fix `window.THREE = THREE` global assignment to only assign if missing: `if (!window.THREE) window.THREE = THREE`

### Refactoring

- [ ] **REFR-01**: Extract `runAnalysis` function out of `src/App.jsx` into `src/engine/analyzer.js`
- [ ] **REFR-02**: Extract GitHub fetch logic (`fetchGitHubFile`, `analyzeGitHubRepository`) into `src/services/github.js`
- [ ] **REFR-03**: Extract PDF export logic into `src/services/pdfExport.js`
- [ ] **REFR-04**: Split `src/App.jsx` UI into sub-components: `InputPanel`, `ResultsPanel`, `ExportButton`
- [ ] **REFR-05**: Create `createLoopDetectorRule(pattern, message)` factory to deduplicate 5 similar "inside loop" rule definitions

### Fix Suggestions

- [ ] **FIXS-01**: Each flagged issue displays a corrected code snippet alongside the problem code
- [ ] **FIXS-02**: Side-by-side diff view: original problematic code vs suggested fix
- [ ] **FIXS-03**: Real-world performance impact estimate shown per issue ("This nested loop on 10k rows ≈ 10s wait")

### Visualization

- [ ] **VIZ-01**: Complexity growth chart showing operation count at N=100, N=1000, N=10000 for detected complexity class
- [ ] **VIZ-02**: Replace plain `<textarea>` with syntax-highlighted code editor (CodeMirror or Monaco Lite)

### Learning

- [ ] **LRN-01**: Interactive fix challenge: user presented with broken code, submits fix, tool validates it passes all rules
- [ ] **LRN-02**: In-context tooltip: hovering jargon terms (e.g., "O(n²)", "linear scan") shows plain-language popover
- [ ] **LRN-03**: "Why this passed" section: brief explanation for each rule that did NOT trigger

### Testing

- [ ] **TEST-01**: Unit tests for GitHub integration: `fetchGitHubFile`, `parseGitHubUrl`, `analyzeGitHubRepository`
- [ ] **TEST-02**: Unit tests for `cleanLines` edge cases: strings with `//`, strings with `/* */`, template literals
- [ ] **TEST-03**: Unit tests for loop depth tracking with mixed indentation, braces-on-same-line, comments between braces
- [ ] **TEST-04**: Performance test: analysis completes in <100ms on 500-line files, <500ms on 2000-line files

### Performance

- [ ] **PERF-01**: Analysis engine runs in Web Worker — UI never blocks during analysis
- [ ] **PERF-02**: Lazy-load jsPDF — only loaded when user clicks "Export PDF", not on initial page load

### Integration

- [ ] **INTG-01**: GitHub Actions workflow file: analyzes PRs and posts results as PR comment
- [ ] **INTG-02**: VS Code extension: analyze currently open file from command palette

## v2 Requirements

Deferred to future milestone.

### Community & Scale

- **COMM-01**: User can submit rule suggestions via GitHub issue template
- **COMM-02**: Community-voted rules appear in "experimental" category
- **COMM-03**: Plugin API accepts user-defined rule modules (JSON/JS)

### History & Progress

- **HIST-01**: Analysis history stored in localStorage (last 10 analyses)
- **HIST-02**: Side-by-side comparison of two historical analyses
- **HIST-03**: Trend chart: complexity score over time for same file

### Mobile

- **MOBL-01**: PWA manifest for install-to-homescreen
- **MOBL-02**: Responsive layout for screens < 768px
- **MOBL-03**: Pause Vanta animation on mobile/low battery

### AI Assistant

- **AIAS-01**: "Ask why" chat interface per issue (calls Claude API)
- **AIAS-02**: Auto-suggest fix using LLM, not just static suggestions

## Out of Scope

| Feature | Reason |
|---------|--------|
| AST-based parsing | Complexity budget; regex sufficient for pattern detection at educational scale |
| Private GitHub repo access | OAuth flow out of scope; privacy-first design |
| Backend code storage | Core privacy guarantee — code never leaves browser |
| Real-time collaborative editing | Not core to analysis use case |
| TypeScript migration | Out of scope for current milestone; considered for v3 |
| Paid plans / freemium | Educational tool stays free |
| Server-side PDF generation | Client-side jsPDF sufficient |
| Full IDE extension marketplace | Deferred to v3 after VS Code prototype validated |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| HLTH-01 | Phase 1 | Pending |
| HLTH-02 | Phase 1 | Pending |
| HLTH-03 | Phase 1 | Pending |
| HLTH-04 | Phase 1 | Pending |
| HLTH-05 | Phase 1 | Pending |
| REFR-01 | Phase 2 | Pending |
| REFR-02 | Phase 2 | Pending |
| REFR-03 | Phase 2 | Pending |
| REFR-04 | Phase 2 | Pending |
| REFR-05 | Phase 2 | Pending |
| TEST-01 | Phase 2 | Pending |
| TEST-02 | Phase 2 | Pending |
| TEST-03 | Phase 2 | Pending |
| TEST-04 | Phase 2 | Pending |
| FIXS-01 | Phase 3 | Pending |
| FIXS-02 | Phase 3 | Pending |
| FIXS-03 | Phase 3 | Pending |
| PERF-01 | Phase 3 | Pending |
| PERF-02 | Phase 3 | Pending |
| VIZ-01 | Phase 4 | Pending |
| VIZ-02 | Phase 4 | Pending |
| LRN-01 | Phase 5 | Pending |
| LRN-02 | Phase 5 | Pending |
| LRN-03 | Phase 5 | Pending |
| INTG-01 | Phase 6 | Pending |
| INTG-02 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 26 total
- Mapped to phases: 26
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-25*
*Last updated: 2026-03-25 after initial definition*
