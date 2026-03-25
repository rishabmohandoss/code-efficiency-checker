// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS & CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

export const SEVERITY = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1
};

export const SEVERITY_COLORS = {
  CRITICAL: { bg:"#ef444418", border:"#ef444450", text:"#f87171", bar:"#ef4444" },
  HIGH:     { bg:"#f9731618", border:"#f9731650", text:"#fb923c", bar:"#f97316" },
  MEDIUM:   { bg:"#eab30818", border:"#eab30850", text:"#fbbf24", bar:"#eab308" },
  LOW:      { bg:"#6b728018", border:"#6b728050", text:"#9ca3af", bar:"#6b7280" },
};

export const COMPLEXITY_HIERARCHY = {
  "O(2ⁿ) worst": 60,
  "O(n³)": 50,
  "O(n² log n)": 40,
  "O(n²)": 30,
  "O(n² space)": 30,
  "O(n×m)": 30,
  "O(n) per check": 10,
  "O(n)": 10
};

export const EXT_LANG = {
  py: "python",
  js: "javascript",
  ts: "typescript",
  java: "java",
  cpp: "cpp",
  go: "go",
  rs: "rust",
  c: "c",
  rb: "ruby",
  swift: "swift"
};

export const LANGUAGES = [
  "python",
  "javascript",
  "typescript",
  "java",
  "cpp",
  "go",
  "rust",
  "c",
  "ruby",
  "swift"
];

export const PLACEHOLDER = `// Paste your code — the engine checks for nested loops,
// O(n²) array scans, unbounded recursion, DOM thrashing, and more.

function findDuplicates(arr) {
  const dupes = [];
  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) {    // ← nested loop → CRITICAL
      if (arr[i] === arr[j] && !dupes.includes(arr[i])) {  // ← .includes() → CRITICAL
        dupes.push(arr[i]);
      }
    }
  }
  return dupes;
}`;

// File size limits
export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
export const MAX_GITHUB_FILE_SIZE = 1024 * 1024; // 1MB
export const MAX_REPO_FILES = 50; // Max files to analyze in a repo

// Timeouts
export const GITHUB_TIMEOUT = 15000; // 15 seconds
export const GITHUB_REPO_TIMEOUT = 20000; // 20 seconds
