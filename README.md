# Code Efficiency Checker

A client-side static analysis tool that scans code for performance anti-patterns and algorithmic inefficiencies. Built with React + Vite, runs entirely in the browser with zero backend dependencies.

Link to website: [https://code-efficiency-checker-flame.vercel.app/](https://vibe-code-checker-psi.vercel.app/)

## Features

- **25 Pattern-Matching Rules** detecting O(n²), O(n³) complexity issues and AI-generated code anti-patterns
- **AI Slop Detection** — identifies common issues in vibecoded/LLM-generated code
- **10 Programming Languages** supported (Python, JavaScript, TypeScript, Java, C++, Go, Rust, C, Ruby, Swift)
- **Three Input Methods**:
  - Paste code directly
  - Upload files (max 5MB)
  - Fetch from GitHub URLs (public repos only)
- **Real-Time Analysis** with Big-O complexity reporting
- **Pure Client-Side** — no backend, no data sent to servers

## Quick Start

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Opens development server at `http://localhost:5173/`

### Build for Production

```bash
npm run build
npm run preview
```

## Usage

1. **Choose Input Method**:
   - **Paste Code**: Directly paste your code into the textarea
   - **Upload File**: Drag & drop or click to browse (supports .py, .js, .ts, .java, .cpp, .go, .rs, .c, .rb, .swift)
   - **GitHub URL**: Paste a GitHub blob URL (e.g., `https://github.com/user/repo/blob/main/file.py`)

2. **Run Analysis**: Click "RUN ANALYSIS"

3. **Review Results**:
   - **FLAGS**: Critical issues detected with explanations and hints
   - **PASSED**: Rules that passed successfully
   - **SOURCE**: View the analyzed code with line numbers

## Rules Detected

### Critical (O(n²) or worse)
- Nested loops
- Triple-nested loops
- Linear scans inside loops (.includes, .indexOf, .find)
- Empty catch blocks (error swallowing)

### High Severity
- Object/array allocation inside loops
- Recursion without memoization
- Sort called inside loops
- Await inside for/while loops (serialization)
- DOM manipulation inside loops
- Missing null/undefined checks on property access
- Unhandled promise rejections
- Infinite loop risks (while(true) without break)

### Medium Severity
- Arrays used as lookup sets
- String concatenation in loops
- Excessive function parameters (>5)
- Callback hell (deeply nested callbacks)

### Low Severity
- console.log inside loops
- Excessively long functions (>60 lines)
- Magic numbers (hardcoded values without constants)

### Language-Specific
- **Python**: Nested list comprehensions, .append() in loops, redundant .keys() iteration
- **JavaScript/TypeScript**: Specific async and DOM-related patterns

### AI Slop Detection

Identifies common anti-patterns in LLM/AI-generated code:

- **Error Swallowing**: Empty catch blocks that hide failures
- **Happy Path Bias**: Missing null checks and edge case handling
- **Defensive Over-Engineering**: Try-catch everywhere without proper handling
- **Callback Hell**: Nested promises instead of async/await
- **Parameter Explosion**: Too many function parameters (use config objects)
- **Infinite Loop Traps**: while(true) without clear exit conditions
- **Magic Numbers**: Scattered hardcoded values instead of named constants

These patterns indicate code that looks right but breaks under real-world conditions.

## Testing

```bash
npm test
```

21 tests covering all rule types, edge cases (multi-line comments, indentation styles), and regression tests for known bugs.

## Known Limitations

1. **Regex-Based Detection**: May have false positives/negatives on complex code
2. **GitHub API**:
   - Public repos only
   - 60 requests/hour (unauthenticated)
   - Max 1MB file size
3. **No AST Parsing**: Uses pattern matching instead of full code parsing
4. **Single File Analysis**: Doesn't analyze dependencies or imports

## Browser Compatibility

Chrome, Firefox, Safari, Edge (latest versions)

## License

[Add your license here]

## Credits

Built with [React](https://react.dev/) and [Vite](https://vitejs.dev/).
