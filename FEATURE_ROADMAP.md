# Feature Roadmap

Based on student testing and real-world usage.

**Priority**: High > Medium > Low
**Effort**: Easy | Medium | Hard

---

## Phase 1: Critical Fixes

### 1.1 Fix Detection Bugs
**Priority**: Critical | **Effort**: Medium

Issues:
- Empty catch blocks not detected reliably
- `await` in loop missed in some patterns
- DOM manipulation in loop not caught
- Unbounded recursion misses fibonacci pattern

**Impact**: Students paste AI code and get false confidence.

---

### 1.2 Add Beginner-Friendly Explanations
**Priority**: Critical | **Effort**: Medium

Current output:
```
"Nested loops produce O(n²) time complexity."
```

Student-friendly output:
```
Why This Is Slow:
Your code checks every item against every other item.
With 100 items: 10,000 checks
With 1,000 items: 1,000,000 checks

Simple Explanation:
Imagine checking if two lists have duplicates.
Bad way: Compare each item in list 1 to every item in list 2
Good way: Put list 2 in a Set, then check list 1 (much faster)

Real-World Impact:
- 10 items: Barely noticeable
- 100 items: Slight delay
- 1,000 items: 2-3 second freeze
- 10,000 items: App crashes
```

Implementation:
- Add `explanation` field to each rule
- Add toggle: "Beginner Mode" vs "Technical Mode"
- Use analogies and concrete numbers

---

### 1.3 Add Code Fix Suggestions
**Priority**: Critical | **Effort**: Hard

Students' top request: "Just show me the fixed code."

Implementation:
- Add `fixTemplate` function to each rule
- Use AST parsing to replace code patterns
- Highlight changes in diff view
- Add "Copy Fixed Code" button

---

## Phase 2: Student Essentials

### 2.1 Export & Share Features
**Priority**: High | **Effort**: Easy

Features:
1. Export as PDF — code snippet, issues found, recommendations
2. Copy Results — formatted markdown, ready to paste
3. Share Link — generates URL, expires after 7 days, no code stored

Libraries: jsPDF, html2canvas, URL shortener

---

### 2.2 Performance Comparison
**Priority**: High | **Effort**: Medium

Show concrete timing estimates for different input sizes, derived from detected complexity class (O(n²) → quadratic growth). Include an optional visual graph.

---

### 2.3 Priority Ranking
**Priority**: High | **Effort**: Easy

Group issues into tiers instead of listing them all equally:
- Critical — fix these first
- Important — fix soon
- Suggestions — nice to have

Score = (severity × impact × frequency) / effort. Show estimated fix time per issue.

---

### 2.4 Line Numbers & Better Editor
**Priority**: High | **Effort**: Easy

Replace the plain textarea with Monaco Editor (VS Code in the browser):
- Line numbers
- Syntax highlighting
- Error squiggles
- Ctrl+F search
- Undo/redo, auto-indent, code folding

Library: Monaco Editor (React wrapper), ~1 day effort.

---

## Phase 3: Learning Features

### 3.1 Interactive Examples
**Priority**: Medium | **Effort**: Medium

"Try an Example" dropdown that pre-fills the editor with realistic code samples showing 5–10 issues. Levels: Beginner, Intermediate, Advanced, Real-world. Hardcode 10–15 examples.

---

### 3.2 Before/After Comparison
**Priority**: Medium | **Effort**: Medium

Split-pane view showing the original (slow) code alongside the fixed (fast) version, with complexity labels below each pane and diff highlighting.

---

### 3.3 Glossary & Learning Resources
**Priority**: Medium | **Effort**: Easy

Clickable terms in results that open a tooltip explaining the concept in plain language, with concrete number examples and links to further reading.

Terms: Big O notation, hash map / Set, recursion / memoization, linear scan, nested loops, callback hell, promise, async/await, DOM manipulation, time complexity, space complexity.

---

### 3.4 Practice Mode
**Priority**: Medium | **Effort**: Hard

Quiz-style learning: show a code snippet, ask what's wrong, reveal the answer with an explanation and fixed version. 50+ challenges, progressive difficulty, progress tracking.

---

## Phase 4: Power User Features

### 4.1 VS Code Extension
**Priority**: Medium | **Effort**: Hard

Real-time squiggly underlines in the editor, hover for explanation, right-click to fix, status bar issue count.

---

### 4.2 GitHub Action
**Priority**: Low | **Effort**: Medium

Auto-analyze pull requests and post a comment with findings. Optional: block merging if critical issues are found.

---

### 4.3 Custom Rules
**Priority**: Low | **Effort**: Hard

Let users define their own rules via a JSON config (id, pattern, severity, message).

---

## Phase 5: Polish & Extras

### 5.1 Mobile App
**Priority**: Low | **Effort**: Hard

React Native or Flutter, same feature set as the web app.

---

### 5.2 AI Chat Assistant
**Priority**: Low | **Effort**: Hard

Conversational Q&A: student asks why their code is slow, assistant explains the specific issue and offers to show a fix.

---

### 5.3 Community Features
**Priority**: Low | **Effort**: Hard

Code sharing, upvoting solutions, leaderboards, discussion forums.

---

## Implementation Priority

### Next 2 weeks
- Fix detection bugs
- Add beginner explanations
- Add code fix suggestions
- Add export PDF
- Add priority ranking

### Next month
- Performance comparison
- Better code editor (Monaco)
- Interactive examples
- Before/after view
- Glossary with tooltips

### Next quarter
- Practice mode
- VS Code extension
- GitHub Action
- Custom rules
- Mobile app

---

## Success Metrics

1. Student satisfaction — survey rating (target: 8.5/10)
2. Completion rate — % who fix all issues (target: 60%)
3. Return users — % who come back (target: 40%)
4. Time to fix — average time from analysis to fix (target: <15 min)
5. Export usage — % who export results (target: 30%)
