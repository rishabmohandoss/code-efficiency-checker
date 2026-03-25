# Code Efficiency Checker

## What This Is

A browser-based static analysis tool that detects performance anti-patterns and algorithmic inefficiencies across 10 programming languages. It runs entirely client-side with no backend, no signup, and no data transmission — paste code, click analyze, get instant results. Targeted at students using AI-generated code and developers doing quick pre-PR sanity checks.

## Core Value

Students paste code and immediately know what's inefficient and why — in plain language, with fixes they can act on.

## Requirements

### Validated

- ✓ Single-pass O(n) analysis engine with 25 detection rules — existing
- ✓ 10 language support (Python, JS, TS, Java, C++, Go, Rust, C, Ruby, Swift) — existing
- ✓ Three input methods: paste, file upload (5MB), GitHub public URL — existing
- ✓ Issue severity levels: Critical, High, Medium, Low — existing
- ✓ AI Slop Detection (7 patterns for LLM-generated code) — existing
- ✓ Beginner Mode toggle with plain-language explanations — existing
- ✓ Priority ranking by impact score (severity × complexity) — existing
- ✓ 9 pre-built example snippets (beginner → expert) — existing
- ✓ PDF export via jsPDF — existing
- ✓ Modular rule registry (performanceRules.js, aiSlopRules.js) — existing
- ✓ Vanta.js animated background — existing

### Active

- [ ] Codebase refactor: extract `runAnalysis` out of App.jsx into dedicated engine module
- [ ] Delete `src/App_old_flashy.jsx` (1055-line dead file polluting the codebase)
- [ ] Fix silent error swallowing in rule execution (`catch (_) {}` → log with rule.id)
- [ ] Fix `cleanLines` comment stripping to not strip URL-like patterns inside strings
- [ ] Code fix suggestions: side-by-side before/after diff for each flagged issue
- [ ] Complexity growth visualization: chart showing O(n) vs O(n²) at scale
- [ ] Syntax-highlighted code editor (CodeMirror or Monaco) replacing plain textarea
- [ ] Interactive fix challenges: broken code → user fixes → validation
- [ ] GitHub Actions integration: auto-analyze PRs, post results as comments
- [ ] VS Code extension: analyze open file without leaving editor
- [ ] Hoist regex patterns to module-level constants (performance fix)
- [ ] Web Worker for analysis: unblock UI on large files

### Out of Scope

- AST-based parsing — regex-based is sufficient for pattern detection at this scale; AST adds build complexity
- Private GitHub repo access — OAuth token management out of scope for educational tool
- Backend code storage — privacy is a core value; no server transmission ever
- Real-time collaborative editing — not core to analysis use case
- Paid plans / freemium — tool is free and educational
- Mobile app — web-first; defer to v3+
- AI chat assistant — defer to v3+ after core learning features ship

## Context

- **Codebase state:** Partially refactored. `src/App.jsx` (~1750 lines) still contains the analysis engine inline; modular structure (`src/rules/`, `src/utils/`, `src/config/`) exists but App.jsx hasn't been fully decoupled. `src/App_old_flashy.jsx` is dead code (1055 lines) — never imported.
- **Primary audience:** Students with tight deadlines copying AI-generated code who need instant validation before submission. Secondary: interview preppers, developers doing pre-PR checks.
- **Detection accuracy issue:** Initial student research showed ~50% detection rate on common patterns. Several fixes were applied (empty catch, DOM manipulation detection). Target is ≥90%.
- **Known fragile areas:** Indentation-based loop depth tracking breaks on mixed tabs/spaces; comment stripping regex breaks on strings containing `//`; `missing-null-check` rule may false-positive on comments.
- **Test state:** Vitest setup with `tests/analyzer.test.js` covering basic cases. No E2E tests. No tests for GitHub integration, large files, or comment-stripping edge cases.

## Constraints

- **Architecture:** Browser-only — all analysis must run in client JS. No Node.js backend.
- **Privacy:** Code never leaves the browser. Non-negotiable constraint.
- **GitHub rate limit:** 60 unauthenticated requests/hour — no workaround without auth flow.
- **Bundle size:** jsPDF added 372KB. New dependencies require justification and lazy-loading where possible.
- **Stack:** React 18 + Vite 7 + JavaScript (no TypeScript migration in v1/v2 scope).
- **Parser:** Regex-based only for now. No AST parsers — complexity budget constraint.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Regex over AST parsing | Keeps build simple; sufficient accuracy for pattern detection at educational scope | — Pending validation at 90% target |
| Client-side only | Privacy guarantee differentiates from competitors; removes infra cost | ✓ Good |
| Beginner Mode as toggle | Avoids overwhelming expert users while still serving students | ✓ Good |
| jsPDF for export | Zero-backend PDF generation; no server round-trip | ⚠️ Revisit — 372KB bundle impact, lazy-load needed |
| Vanta.js background | Visual polish for student appeal | ⚠️ Revisit — legacy library, breaks on some environments |
| App.jsx monolith → modules | Started refactor, engine still partially in App.jsx | — Pending — complete refactor is Active requirement |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-25 after initialization*
