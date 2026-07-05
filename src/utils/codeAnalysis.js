// ═══════════════════════════════════════════════════════════════════════════════
// CODE ANALYSIS UTILITY FUNCTIONS
// Helper functions for parsing and analyzing code structure
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Improved comment stripping that handles multi-line comments properly
 * @param {string[]} lines - Array of code lines
 * @returns {string[]} - Cleaned lines without comments
 */
export const cleanLines = (lines) => {
  const result = [];
  let inMultiLineComment = false;

  for (let line of lines) {
    let cleaned = line;

    // Handle multi-line comments
    if (inMultiLineComment) {
      const endIdx = cleaned.indexOf('*/');
      if (endIdx !== -1) {
        cleaned = cleaned.substring(endIdx + 2);
        inMultiLineComment = false;
      } else {
        continue; // Skip this line entirely
      }
    }

    // Remove /* */ comments (could start multi-line)
    while (cleaned.indexOf('/*') !== -1) {
      const startIdx = cleaned.indexOf('/*');
      const endIdx = cleaned.indexOf('*/', startIdx);
      if (endIdx !== -1) {
        cleaned = cleaned.substring(0, startIdx) + cleaned.substring(endIdx + 2);
      } else {
        cleaned = cleaned.substring(0, startIdx);
        inMultiLineComment = true;
        break;
      }
    }

    // Remove single-line comments (// and #)
    cleaned = cleaned.replace(/\/\/.*$|#.*$/, "").trim();

    if (cleaned) result.push(cleaned);
  }

  return result;
};

/**
 * Detect indentation style from the code
 * @param {string[]} lines - Array of code lines
 * @returns {number} - Detected indent size (1 for tabs, 2/4 for spaces)
 */
export const detectIndentSize = (lines) => {
  const indents = [];
  let prevIndent = 0;

  for (const line of lines) {
    const match = line.match(/^(\s+)/);
    if (match) {
      const spaces = match[1];
      // Check for tabs
      if (spaces.includes('\t')) return 1; // Tab = 1 unit

      const currentIndent = spaces.length;
      const diff = Math.abs(currentIndent - prevIndent);
      if (diff > 0 && diff < 10) { // Reasonable indent size
        indents.push(diff);
      }
      prevIndent = currentIndent;
    }
  }

  if (indents.length === 0) return 2; // Default to 2 spaces

  // Find most common indent size
  const counts = {};
  indents.forEach(i => counts[i] = (counts[i] || 0) + 1);
  // No initial value: the previous `, 2` seed made the first comparison
  // counts[2] vs counts[b], where counts[2] is usually undefined, so the
  // seed always lost and could skew ties. keys is guaranteed non-empty here.
  return parseInt(Object.keys(counts).reduce((a, b) => counts[a] >= counts[b] ? a : b), 10);
};

/**
 * Calculate nesting depth with auto-detected indentation
 * @param {number} indentSize - Size of one indentation level
 * @returns {Function} - Function that calculates depth for a line
 */
export const nestingDepthFactory = (indentSize) => (line) => {
  const match = line.match(/^(\s+)/);
  if (!match) return 0;

  const spaces = match[1];
  if (spaces.includes('\t')) {
    return spaces.split('\t').length - 1;
  }
  return Math.floor(spaces.length / indentSize);
};

/**
 * Check if code has nested loops (depth >= 2)
 * @param {string[]} rawLines - Raw code lines
 * @param {Function} nestingDepth - Nesting depth calculator
 * @returns {boolean}
 */
export const hasNestedLoops = (rawLines, nestingDepth) =>
  maxLoopDepth(rawLines, nestingDepth) >= 2;

/**
 * Check if code has linear scan inside a loop
 * @param {string[]} rawLines - Raw code lines
 * @param {Function} nestingDepth - Nesting depth calculator
 * @returns {boolean}
 */
export const hasLinearScanInLoop = (rawLines, nestingDepth) => {
  const loopRx = /\b(for|while|forEach)\b/;
  const scanRx = /\.(includes|indexOf|find|filter|some|every|search)\s*\(/;
  let inLoop = false, loopDepth = 0;

  for (const line of rawLines) {
    const d = nestingDepth(line);
    if (loopRx.test(line)) { inLoop = true; loopDepth = d; }
    if (inLoop && d > loopDepth && scanRx.test(line)) return true;
    if (inLoop && d <= loopDepth && !loopRx.test(line)) inLoop = false;
  }
  return false;
};

/**
 * Calculate maximum loop nesting depth
 * @param {string[]} rawLines - Raw code lines
 * @param {Function} nestingDepth - Nesting depth calculator
 * @returns {number}
 */
export const maxLoopDepth = (rawLines, nestingDepth) => {
  const loopRx = /\b(for|while|forEach|map|filter)\b/;
  let max = 0, cur = 0;

  for (const line of rawLines) {
    if (loopRx.test(line)) { cur++; max = Math.max(max, cur); }
    else if (/^\s*(}|\))\s*$/.test(line) && cur > 0) cur--;
  }
  return max;
};
