# Code Efficiency Checker

A client-side static analysis tool that scans code for performance anti-patterns and algorithmic inefficiencies. Built with React + Vite, runs entirely in the browser with zero backend dependencies.

Link to website: [https://code-efficiency-checker-flame.vercel.app/](https://vibe-code-checker-psi.vercel.app/) 

## Features

- **25 Pattern-Matching Rules** detecting O(n²), O(n³) complexity issues & AI-generated code anti-patterns
- **AI Slop Detection** - identifies common issues in vibecoded/LLM-generated code
- **10 Programming Languages** supported (Python, JavaScript, TypeScript, Java, C++, Go, Rust, C, Ruby, Swift)
- **Three Input Methods**:
  - Paste code directly
  - Upload files (max 5MB)
  - Fetch from GitHub URLs (public repos only)
- **Real-Time Analysis** with Big-O complexity reporting
- **Pure Client-Side** - no backend, no data sent to servers

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

2. **Run Analysis**: Click "RUN ANALYSIS" button

3. **Review Results**:
   - **FLAGS**: Critical issues detected with explanations and hints
   - **PASSED**: Rules that passed successfully
   - **SOURCE**: View the analyzed code with line numbers

## Rules Detected

### Critical (O(n²) or worse)
- Nested loops
- Triple-nested loops
- Linear scans inside loops (.includes, .indexOf, .find)
- **Empty catch blocks** (error swallowing)

### High Severity
- Object/array allocation inside loops
- Recursion without memoization
- Sort called inside loops
- Await inside for/while loops (serialization)
- DOM manipulation inside loops
- **Missing null/undefined checks** on property access
- **Unhandled promise rejections**
- **Infinite loop risks** (while(true) without break)

### Medium Severity
- Arrays used as lookup sets
- String concatenation in loops
- **Excessive function parameters** (>5)
- **Callback hell** (deeply nested callbacks)

### Low Severity
- console.log inside loops
- Excessively long functions (>60 lines)
- **Magic numbers** (hardcoded values without constants)

### Language-Specific
- **Python**: Nested list comprehensions, .append() in loops, redundant .keys() iteration
- **JavaScript/TypeScript**: Specific async and DOM-related patterns

### AI Slop Detection 🤖
Identifies common anti-patterns in LLM/AI-generated "vibecoded" code:

- **Error Swallowing**: Empty catch blocks that hide failures
- **Happy Path Bias**: Missing null checks and edge case handling
- **Defensive Over-Engineering**: Try-catch everywhere without proper handling
- **Callback Hell**: Nested promises instead of async/await
- **Parameter Explosion**: Too many function parameters (use config objects)
- **Infinite Loop Traps**: while(true) without clear exit conditions
- **Magic Numbers**: Scattered hardcoded values instead of named constants

These patterns indicate code that "looks right" but breaks under real-world conditions.

## Recent Improvements

### Latest Update - AI Slop Detection Added! 🤖
9. ✅ **AI Slop Detection**: 7 new rules detecting common issues in LLM-generated code
   - Empty catch blocks
   - Missing null checks
   - Unhandled promises
   - Infinite loop risks
   - Excessive parameters
   - Callback hell
   - Magic numbers

### Fixed Issues (Previous Update)
1. ✅ **Syntax Error**: Removed stray `cd` text (line 968)
2. ✅ **Security**: Updated vite to v8.0.2 (fixed 2 moderate vulnerabilities)
3. ✅ **Comment Stripping**: Improved multi-line comment handling
4. ✅ **Indentation Detection**: Auto-detects 2-space, 4-space, and tab indentation
5. ✅ **Loop Exit Logic**: Fixed premature loop exit on empty lines/braces
6. ✅ **File Size Validation**: Added 5MB limit for uploads
7. ✅ **GitHub Timeout**: Added 15-second timeout and better error messages
8. ✅ **File Type Validation**: Rejects unsupported file types

### Performance
- **O(n) Single-Pass Architecture**: Scans code once instead of nested loops
- Optimized pattern matching with Set-based tracking
- No redundant complexity calculations

## Architecture

```
src/
├── App.jsx           # Main application component
│   ├── Rule Engine   # Pattern-matching rules (lines 119-365)
│   ├── Helpers       # Comment stripping, nesting depth, loop detection
│   ├── Analysis      # runAnalysis() function (single-pass O(n))
│   ├── GitHub        # Fetcher with timeout and validation
│   └── UI            # React components (badges, cards, tabs)
├── main.jsx          # React entry point
└── ...
```

## Testing

Test suite is defined in `tests/analyzer.test.js` with 20+ test cases covering:
- All rule types (nested loops, recursion, etc.)
- Edge cases (multi-line comments, different indentation styles)
- Language-specific patterns (Python comprehensions, etc.)

To run tests:
```bash
npm install -D vitest
npm test
```

## Known Limitations

1. **Regex-Based Detection**: May have false positives/negatives on complex code
2. **GitHub API**:
   - Public repos only
   - 60 requests/hour (unauthenticated)
   - Max 1MB file size
3. **No AST Parsing**: Uses pattern matching instead of full code parsing
4. **Single File Analysis**: Doesn't analyze dependencies or imports

## Browser Compatibility

- Modern browsers with ES6+ support
- Chrome, Firefox, Safari, Edge (latest versions)

## Contributing

This project is a static analysis tool. When contributing:
- Maintain O(n) performance in analysis engine
- Add tests for new rules
- Update this README with new features

## License

[Add your license here]

## Credits

Built with:
- [React](https://react.dev/)
- [Vite](https://vitejs.dev/)
- Pattern-matching algorithm inspired by ESLint

---

**Note**: This tool is for educational and optimization purposes. It provides suggestions, not absolute rules. Always profile your specific use case before optimizing.
