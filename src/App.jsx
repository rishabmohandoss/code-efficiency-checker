import { useState, useRef, useCallback, useEffect } from "react";
import { jsPDF } from "jspdf";
import * as THREE from "three";
import TOPOLOGY from "vanta/dist/vanta.topology.min";
import { RULES } from './rules/index.js';

// Make THREE available globally for Vanta.js
if (typeof window !== 'undefined') {
  window.THREE = THREE;
}
import {
  SEVERITY,
  COMPLEXITY_HIERARCHY,
  EXT_LANG,
  LANGUAGES,
  MAX_FILE_SIZE,
  MAX_GITHUB_FILE_SIZE,
  MAX_REPO_FILES,
  GITHUB_TIMEOUT,
  GITHUB_REPO_TIMEOUT,
  PLACEHOLDER
} from './config/constants.js';
import { cleanLines, detectIndentSize, nestingDepthFactory, hasNestedLoops, hasLinearScanInLoop, maxLoopDepth } from './utils/codeAnalysis.js';
import { EXAMPLE_LIST } from './utils/examples.js';
import { getBeginnerExplanation, calculateImpactScore } from './utils/beginnerExplanations.js';

// ═══════════════════════════════════════════════════════════════════════════════
// RULE ENGINE — Pure local pattern matching, zero external dependencies
// ═══════════════════════════════════════════════════════════════════════════════

// ── All constants and rules now imported from modular files ──────────────────
// RULES (25 total): imported from rules/index.js
// Constants: imported from config/constants.js
// Helper functions: imported from utils/codeAnalysis.js

// ── Original RULES array removed (now in src/rules/) ─────────────────────────

// ── Run engine ────────────────────────────────────────────────────────────────
function runAnalysis(code, language) {
  const rawLines = code.split("\n");
  const lines = cleanLines(rawLines);
  const flags = [];
  const passed = [];

  // Detect indentation and create nestingDepth function
  const indentSize = detectIndentSize(rawLines);
  const nestingDepth = nestingDepthFactory(indentSize);

  // --- 1. SINGLE PASS ARCHITECTURE (Fixes O(n³)) ---
  // We scan the file exactly ONCE to check all loop-related rules.
  const loopRx = /\b(for|while|forEach)\b/;
  let inLoop = false;
  let currentLoopDepth = 0;
  const triggeredRuleIds = new Set();

  for (const line of lines) {
    const d = nestingDepth(line);

    // Start tracking loop
    if (loopRx.test(line)) {
      inLoop = true;
      currentLoopDepth = d;
    }

    // Check for issues inside loop (must be at greater depth)
    if (inLoop && d > currentLoopDepth) {
      if (!triggeredRuleIds.has("linear-scan-in-loop") && /\.(includes|indexOf|find|filter|some|every|search)\s*\(/.test(line)) {
        triggeredRuleIds.add("linear-scan-in-loop");
      }
      if (!triggeredRuleIds.has("alloc-in-loop") && /new\s+(Array|Object|Map|Set|Date|\w+)\s*\(|=\s*\[\]|=\s*\{\}/.test(line)) {
        triggeredRuleIds.add("alloc-in-loop");
      }
      if (!triggeredRuleIds.has("sort-in-loop") && /\.sort\s*\(|sorted\s*\(|Collections\.sort/.test(line)) {
        triggeredRuleIds.add("sort-in-loop");
      }
      if (!triggeredRuleIds.has("async-in-loop") && /\bawait\b/.test(line)) {
        triggeredRuleIds.add("async-in-loop");
      }
      if (!triggeredRuleIds.has("dom-in-loop") && /document\.(getElementById|querySelector|createElement|appendChild)|\.innerHTML|\.classList\./.test(line)) {
        triggeredRuleIds.add("dom-in-loop");
      }
    }

    // Exit loop tracking when depth drops below loop level
    // This means we've moved to code outside the loop
    if (inLoop && d < currentLoopDepth) {
      // Make sure we're not just on an empty line or a line with only whitespace
      // We want to exit when we hit actual code at a lower depth OR a closing brace
      const trimmed = line.trim();
      if (trimmed.length > 0) {
        inLoop = false;
      }
    }
  }

  // --- 2. EVALUATE RULES ---
  for (const rule of RULES) {
    if (rule.languages !== "*" && !rule.languages.includes(language)) continue;

    let triggered = false;

    // Check if our single-pass already caught it
    if (triggeredRuleIds.has(rule.id)) {
      triggered = true;
    }
    // Otherwise, run the standard test for non-loop rules
    else if (!["linear-scan-in-loop", "alloc-in-loop", "sort-in-loop", "async-in-loop", "dom-in-loop"].includes(rule.id)) {
      try {
        triggered = rule.test(lines, code, rawLines, nestingDepth);
      } catch (_) {}
    }

    if (triggered) {
      flags.push({ ...rule, message: rule.dynamic ? rule.dynamic(lines) : rule.message, pass: false });
    } else {
      passed.push(rule);
    }
  }

  // --- 3. CALCULATE COMPLEXITIES (Fixes O(n²) Scans) ---
  let worstScore = 0;
  let worstComplexity = "O(n)";

  for (const flag of flags) {
    if (flag.complexity && COMPLEXITY_HIERARCHY[flag.complexity]) {
      const score = COMPLEXITY_HIERARCHY[flag.complexity];
      if (score > worstScore) {
        worstScore = score;
        worstComplexity = flag.complexity;
      }
    }
  }

  return {
    passed,
    flags,
    stats: {
      totalRules: RULES.length,
      passed: passed.length,
      failed: flags.length,
      complexity: worstComplexity
    }
  };
}

// ── Constants for EXT_LANG mapping ───────────────────────────────────────────
const LANGUAGES_DISPLAY = {
  javascript: "JavaScript",
  typescript: "TypeScript",
  python: "Python",
  java: "Java",
  cpp: "C++",
  go: "Go",
  rust: "Rust",
  c: "C",
  ruby: "Ruby",
  swift: "Swift"
};

// ── SEVERITY_COLORS for UI rendering ─────────────────────────────────────────
const SEVERITY_COLORS = {
  CRITICAL: { bg:"rgba(220, 38, 38, 0.08)", border:"rgba(220, 38, 38, 0.3)", text:"#ef4444", badge:"#dc2626" },
  HIGH:     { bg:"rgba(249, 115, 22, 0.08)", border:"rgba(249, 115, 22, 0.3)", text:"#f97316", badge:"#ea580c" },
  MEDIUM:   { bg:"rgba(234, 179, 8, 0.08)", border:"rgba(234, 179, 8, 0.3)", text:"#eab308", badge:"#ca8a04" },
  LOW:      { bg:"rgba(107, 114, 128, 0.08)", border:"rgba(107, 114, 128, 0.3)", text:"#9ca3af", badge:"#6b7280" },
};

// ── GITHUB INTEGRATION ────────────────────────────────────────────────────────

// Parse GitHub URL to extract owner, repo, branch, path
function parseGitHubUrl(url) {
  const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)(?:\/(?:blob|tree)\/([^\/]+)(?:\/(.+))?)?/);
  if (!match) return null;

  const [, owner, repo, branch = "main", path] = match;
  const isRepoUrl = !path || path.trim() === "";

  return { owner, repo, branch, path, isRepoUrl };
}

// Fetch content of a single file from GitHub
async function fetchGitHubFile(info, signal) {
  const { owner, repo, path, branch } = info;
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;

  const res = await fetch(apiUrl, { signal });
  if (!res.ok) throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);

  const data = await res.json();
  if (data.encoding === "base64") {
    return atob(data.content.replace(/\n/g, ""));
  }
  throw new Error("Unexpected encoding from GitHub API");
}

// Fetch repository tree (all files)
async function fetchGitHubRepoTree(info, signal) {
  const { owner, repo, branch } = info;
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;

  const res = await fetch(apiUrl, { signal });
  if (!res.ok) throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);

  const data = await res.json();

  // Filter for code files only
  const codeExtensions = Object.keys(EXT_LANG);
  const ignoredPaths = ['node_modules/', '.git/', 'dist/', 'build/', 'vendor/', 'test/', 'tests/', '__pycache__/'];

  const codeFiles = data.tree
    .filter(item => {
      if (item.type !== 'blob') return false;
      if (ignoredPaths.some(p => item.path.includes(p))) return false;
      const ext = item.path.split('.').pop().toLowerCase();
      return codeExtensions.includes(ext);
    })
    .slice(0, MAX_REPO_FILES);

  return { files: codeFiles, branch };
}

// Analyze entire repository
async function analyzeGitHubRepository(info, onProgress, signal) {
  const { files, branch } = await fetchGitHubRepoTree(info, signal);
  const results = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    onProgress && onProgress({ current: i + 1, total: files.length, file: file.path });

    try {
      const fileInfo = { ...info, path: file.path, branch };
      const content = await fetchGitHubFile(fileInfo, signal);
      const ext = file.path.split('.').pop().toLowerCase();
      const language = EXT_LANG[ext] || 'javascript';
      const analysis = runAnalysis(content, language);

      results.push({
        path: file.path,
        language,
        analysis,
        size: file.size
      });

      // Rate limiting: small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (err) {
      results.push({
        path: file.path,
        error: err.message
      });
    }
  }

  return {
    repoName: `${info.owner}/${info.repo}`,
    results
  };
}

// ── REACT COMPONENT ───────────────────────────────────────────────────────────

function App() {
  const [code, setCode] = useState("");
  const [result, setResult] = useState(null);
  const [language, setLanguage] = useState("javascript");
  const [method, setMethod] = useState("paste");
  const [githubUrl, setGithubUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [repoProgress, setRepoProgress] = useState(null);
  const [beginnerMode, setBeginnerMode] = useState(false);
  const [showExamples, setShowExamples] = useState(false);
  const fileInputRef = useRef(null);
  const abortControllerRef = useRef(null);
  const vantaRef = useRef(null);
  const vantaEffect = useRef(null);

  const handleAnalyze = useCallback(async () => {
    if (!code.trim() && method !== 'github') {
      setError("Please provide some code to analyze");
      return;
    }

    if (method === 'github' && !githubUrl.trim()) {
      setError("Please provide a GitHub URL");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);
    setRepoProgress(null);

    try {
      let analysisResult;
      let sourceCode = code;

      if (method === 'github') {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }

        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;

        const info = parseGitHubUrl(githubUrl);
        if (!info) {
          throw new Error("Invalid GitHub URL format");
        }

        if (info.isRepoUrl) {
          const repoResult = await analyzeGitHubRepository(
            info,
            (progress) => setRepoProgress(progress),
            signal
          );

          setResult({
            type: 'repository',
            data: repoResult
          });
          setLoading(false);
          return;
        } else {
          sourceCode = await fetchGitHubFile(info, signal);
          const ext = info.path.split('.').pop().toLowerCase();
          const detectedLang = EXT_LANG[ext] || 'javascript';
          setLanguage(detectedLang);
        }
      }

      analysisResult = runAnalysis(sourceCode, language);
      setResult({
        type: 'single',
        data: analysisResult
      });

    } catch (err) {
      if (err.name === 'AbortError') {
        setError("Request cancelled");
      } else {
        setError(err.message || "Analysis failed");
      }
    } finally {
      setLoading(false);
      setRepoProgress(null);
    }
  }, [code, language, method, githubUrl]);

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      setError(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`);
      return;
    }

    const ext = file.name.split('.').pop().toLowerCase();
    const detectedLang = EXT_LANG[ext];
    if (detectedLang) {
      setLanguage(detectedLang);
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setCode(event.target.result || "");
      setError("");
    };
    reader.onerror = () => {
      setError("Failed to read file");
    };
    reader.readAsText(file);
  };

  const handleExportPDF = () => {
    if (!result || !result.data) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const maxWidth = pageWidth - 2 * margin;
    let yPos = margin;

    // Helper function to add text with word wrap
    const addText = (text, fontSize = 12, isBold = false) => {
      doc.setFontSize(fontSize);
      doc.setFont("helvetica", isBold ? "bold" : "normal");
      const lines = doc.splitTextToSize(text, maxWidth);

      // Check if we need a new page
      if (yPos + (lines.length * fontSize * 0.5) > pageHeight - margin) {
        doc.addPage();
        yPos = margin;
      }

      doc.text(lines, margin, yPos);
      yPos += lines.length * fontSize * 0.5 + 5;
    };

    const addSpacing = (space = 5) => {
      yPos += space;
    };

    // Title
    addText("Code Efficiency Analysis Report", 20, true);
    addText(`Generated: ${new Date().toLocaleString()}`, 10);
    addSpacing(10);

    // Stats
    if (result.type === 'single') {
      addText("Analysis Summary", 16, true);
      addText(`Total Rules Checked: ${result.data.stats.totalRules}`, 12);
      addText(`Passed: ${result.data.stats.passed}`, 12);
      addText(`Failed: ${result.data.stats.failed}`, 12);
      addText(`Worst Complexity: ${result.data.stats.complexity}`, 12);
      addSpacing(10);

      // Issues
      if (result.data.flags.length > 0) {
        addText(`Issues Found (${result.data.flags.length})`, 16, true);
        addSpacing(5);

        const sortedFlags = [...result.data.flags].sort((a, b) =>
          calculateImpactScore(b) - calculateImpactScore(a)
        );

        sortedFlags.forEach((flag, i) => {
          addText(`${i + 1}. ${flag.title} [${flag.severity}]`, 12, true);
          addText(`${flag.message}`, 10);

          if (flag.hint) {
            addText(`Hint: ${flag.hint}`, 9);
          }

          if (flag.complexity) {
            addText(`Time Complexity: ${flag.complexity}`, 9);
          }

          if (beginnerMode) {
            const explanation = getBeginnerExplanation(flag.id);
            addSpacing(3);
            addText("Beginner Explanation:", 9, true);
            addText(`What's happening: ${explanation.simple}`, 8);
            addText(`Impact: ${explanation.impact}`, 8);
            addText(`Fix: ${explanation.fix}`, 8);
          }

          addSpacing(8);
        });
      }

      // Passed rules
      if (result.data.passed.length > 0) {
        addText(`Passed Rules (${result.data.passed.length})`, 16, true);
        result.data.passed.forEach((rule, i) => {
          if (i > 0 && i % 3 === 0) addSpacing(2);
          addText(`• ${rule.title}`, 9);
        });
      }
    } else if (result.type === 'repository') {
      addText(`Repository Analysis: ${result.data.repoName}`, 16, true);
      addText(`Files Analyzed: ${result.data.results.length}`, 12);
      addSpacing(10);

      result.data.results.forEach((fileResult, i) => {
        addText(`${i + 1}. ${fileResult.path}`, 11, true);
        if (fileResult.error) {
          addText(`Error: ${fileResult.error}`, 9);
        } else {
          addText(`Passed: ${fileResult.analysis.stats.passed} | Failed: ${fileResult.analysis.stats.failed} | Complexity: ${fileResult.analysis.stats.complexity}`, 9);
        }
        addSpacing(5);
      });
    }

    // Footer
    yPos = pageHeight - 15;
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("Generated by Code Efficiency Checker - 100% client-side analysis", margin, yPos);

    // Save
    const filename = result.type === 'repository'
      ? `analysis-${result.data.repoName.replace('/', '-')}.pdf`
      : `code-analysis-${new Date().toISOString().split('T')[0]}.pdf`;

    doc.save(filename);
  };

  // Initialize Vanta.js background effect
  useEffect(() => {
    if (!vantaEffect.current && vantaRef.current) {
      try {
        vantaEffect.current = TOPOLOGY({
          el: vantaRef.current,
          mouseControls: true,
          touchControls: true,
          gyroControls: false,
          minHeight: 200.00,
          minWidth: 200.00,
          scale: 1.00,
          scaleMobile: 1.00,
          color: 0x3b82f6,
          backgroundColor: 0x0a0a0a,
          points: 8.00,
          maxDistance: 20.00,
          spacing: 16.00
        });
      } catch (error) {
        console.error('Vanta.js initialization error:', error);
      }
    }
    return () => {
      if (vantaEffect.current) {
        try {
          vantaEffect.current.destroy();
        } catch (error) {
          console.error('Vanta.js cleanup error:', error);
        }
      }
    };
  }, []);

  return (
    <div style={{
      minHeight:"100vh",
      background:"#0a0a0a",
      color:"#e5e7eb",
      fontFamily:"'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      {/* Vanta.js animated background */}
      <div
        ref={vantaRef}
        style={{
          position:"fixed",
          inset:0,
          zIndex:0
        }}
      />

      {/* Content */}
      <div style={{ position:"relative", zIndex:1, maxWidth:1200, margin:"0 auto", padding:"40px 24px" }}>

        {/* Header */}
        <header style={{ marginBottom:48 }}>
          <div style={{
            display:"inline-block",
            padding:"4px 12px",
            background:"rgba(59, 130, 246, 0.1)",
            border:"1px solid rgba(59, 130, 246, 0.2)",
            borderRadius:4,
            fontSize:12,
            fontWeight:500,
            color:"#60a5fa",
            marginBottom:16,
            letterSpacing:"0.5px"
          }}>
            {RULES.length} RULES · CLIENT-SIDE · PRIVACY-FIRST
          </div>

          <h1 style={{
            fontSize:48,
            fontWeight:600,
            margin:"0 0 12px 0",
            color:"#ffffff",
            letterSpacing:"-0.02em"
          }}>
            Code Efficiency Checker
          </h1>

          <p style={{
            fontSize:18,
            color:"#9ca3af",
            margin:0,
            maxWidth:600
          }}>
            Detect algorithmic inefficiencies and AI-generated code issues. 100% client-side analysis with zero data collection.
          </p>
        </header>

        {/* Main input panel */}
        <div style={{
          background:"rgba(255,255,255,0.03)",
          border:"1px solid rgba(255,255,255,0.1)",
          borderRadius:8,
          marginBottom:32,
          overflow:"hidden"
        }}>
          {/* Tabs */}
          <div style={{
            display:"flex",
            borderBottom:"1px solid rgba(255,255,255,0.1)",
            background:"rgba(0,0,0,0.2)"
          }}>
            {[
              { id: 'paste', label: 'Paste Code' },
              { id: 'upload', label: 'Upload File' },
              { id: 'github', label: 'GitHub URL' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setMethod(tab.id)}
                style={{
                  flex:1,
                  padding:"14px 20px",
                  background: method === tab.id ? "rgba(59, 130, 246, 0.1)" : "transparent",
                  border:"none",
                  borderBottom: method === tab.id ? "2px solid #3b82f6" : "2px solid transparent",
                  color: method === tab.id ? "#60a5fa" : "#6b7280",
                  fontSize:14,
                  fontWeight:500,
                  cursor:"pointer",
                  transition:"all 0.2s ease",
                  fontFamily:"inherit"
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div style={{ padding:24 }}>
            {method === 'paste' && (
              <>
                <textarea
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder={PLACEHOLDER}
                  style={{
                    width:"100%",
                    height:300,
                    padding:16,
                    background:"#000000",
                    border:"1px solid rgba(255,255,255,0.1)",
                    borderRadius:6,
                    color:"#e5e7eb",
                    fontSize:14,
                    fontFamily:"'JetBrains Mono', 'Courier New', monospace",
                    resize:"vertical",
                    marginBottom:16,
                    lineHeight:1.6,
                    outline:"none"
                  }}
                  onFocus={(e) => e.target.style.borderColor = "rgba(59, 130, 246, 0.5)"}
                  onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
                />
                <div style={{ display:"flex", gap:12, marginBottom:16 }}>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    style={{
                      padding:"10px 16px",
                      background:"#000000",
                      border:"1px solid rgba(255,255,255,0.1)",
                      borderRadius:6,
                      color:"#e5e7eb",
                      fontSize:14,
                      cursor:"pointer",
                      flex:1,
                      fontFamily:"inherit",
                      outline:"none"
                    }}
                  >
                    {LANGUAGES.map(lang => (
                      <option key={lang} value={lang}>{LANGUAGES_DISPLAY[lang] || lang}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => setShowExamples(!showExamples)}
                    style={{
                      padding:"10px 20px",
                      background:"rgba(139, 92, 246, 0.1)",
                      border:"1px solid rgba(139, 92, 246, 0.3)",
                      borderRadius:6,
                      color:"#a78bfa",
                      fontSize:14,
                      fontWeight:500,
                      cursor:"pointer",
                      transition:"all 0.2s ease",
                      fontFamily:"inherit",
                      whiteSpace:"nowrap"
                    }}
                    onMouseOver={(e) => e.target.style.background = "rgba(139, 92, 246, 0.15)"}
                    onMouseOut={(e) => e.target.style.background = "rgba(139, 92, 246, 0.1)"}
                  >
                    Try Example {showExamples ? "▲" : "▼"}
                  </button>
                </div>
                {showExamples && (
                  <div style={{
                    marginBottom:16,
                    padding:12,
                    background:"rgba(0,0,0,0.5)",
                    border:"1px solid rgba(139, 92, 246, 0.3)",
                    borderRadius:6
                  }}>
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(250px, 1fr))", gap:8 }}>
                      {EXAMPLE_LIST.map(ex => (
                        <button
                          key={ex.id}
                          onClick={() => {
                            setCode(ex.code);
                            setLanguage(ex.language);
                            setShowExamples(false);
                            setError("");
                          }}
                          style={{
                            padding:"12px 16px",
                            background:"rgba(139, 92, 246, 0.1)",
                            border:"1px solid rgba(139, 92, 246, 0.2)",
                            borderRadius:6,
                            color:"#e5e7eb",
                            fontSize:13,
                            fontWeight:500,
                            cursor:"pointer",
                            transition:"all 0.2s ease",
                            fontFamily:"inherit",
                            textAlign:"left"
                          }}
                          onMouseOver={(e) => {
                            e.target.style.background = "rgba(139, 92, 246, 0.2)";
                            e.target.style.borderColor = "rgba(139, 92, 246, 0.4)";
                          }}
                          onMouseOut={(e) => {
                            e.target.style.background = "rgba(139, 92, 246, 0.1)";
                            e.target.style.borderColor = "rgba(139, 92, 246, 0.2)";
                          }}
                        >
                          <div style={{ fontWeight:600, marginBottom:4, color:"#a78bfa" }}>{ex.title}</div>
                          <div style={{ fontSize:11, color:"#9ca3af" }}>{ex.description}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {method === 'upload' && (
              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".js,.ts,.py,.java,.cpp,.c,.go,.rs,.rb,.swift"
                  style={{ display:"none" }}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    width:"100%",
                    padding:48,
                    background:"rgba(59, 130, 246, 0.05)",
                    border:"2px dashed rgba(59, 130, 246, 0.3)",
                    borderRadius:6,
                    color:"#60a5fa",
                    fontSize:16,
                    fontWeight:500,
                    cursor:"pointer",
                    transition:"all 0.2s ease",
                    fontFamily:"inherit"
                  }}
                  onMouseOver={(e) => e.target.style.background = "rgba(59, 130, 246, 0.1)"}
                  onMouseOut={(e) => e.target.style.background = "rgba(59, 130, 246, 0.05)"}
                >
                  Click to upload file (max {MAX_FILE_SIZE / 1024 / 1024}MB)
                </button>
                {code && (
                  <div style={{
                    marginTop:16,
                    padding:12,
                    background:"rgba(16, 185, 129, 0.1)",
                    border:"1px solid rgba(16, 185, 129, 0.3)",
                    borderRadius:6,
                    color:"#10b981",
                    fontSize:14
                  }}>
                    ✓ File loaded ({code.length} characters)
                  </div>
                )}
              </div>
            )}

            {method === 'github' && (
              <>
                <input
                  type="text"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  placeholder="https://github.com/owner/repo/blob/main/file.js"
                  style={{
                    width:"100%",
                    padding:"12px 16px",
                    background:"#000000",
                    border:"1px solid rgba(255,255,255,0.1)",
                    borderRadius:6,
                    color:"#e5e7eb",
                    fontSize:14,
                    fontFamily:"'JetBrains Mono', monospace",
                    marginBottom:8,
                    outline:"none"
                  }}
                  onFocus={(e) => e.target.style.borderColor = "rgba(59, 130, 246, 0.5)"}
                  onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
                />
                <p style={{ fontSize:12, color:"#6b7280", margin:0 }}>
                  Supports single files or entire repositories (analyzes up to {MAX_REPO_FILES} files)
                </p>
              </>
            )}

            {error && (
              <div style={{
                marginTop:16,
                padding:12,
                background:"rgba(220, 38, 38, 0.1)",
                border:"1px solid rgba(220, 38, 38, 0.3)",
                borderRadius:6,
                color:"#ef4444",
                fontSize:14
              }}>
                {error}
              </div>
            )}

            <button
              onClick={handleAnalyze}
              disabled={loading}
              style={{
                width:"100%",
                marginTop:16,
                padding:"14px 24px",
                background: loading ? "rgba(59, 130, 246, 0.5)" : "#3b82f6",
                border:"none",
                borderRadius:6,
                color:"#ffffff",
                fontSize:16,
                fontWeight:600,
                cursor: loading ? "not-allowed" : "pointer",
                transition:"all 0.2s ease",
                fontFamily:"inherit",
                opacity: loading ? 0.7 : 1
              }}
              onMouseOver={(e) => !loading && (e.target.style.background = "#2563eb")}
              onMouseOut={(e) => !loading && (e.target.style.background = "#3b82f6")}
            >
              {loading ? (repoProgress ? `Analyzing ${repoProgress.current}/${repoProgress.total}...` : "Analyzing...") : "Analyze Code"}
            </button>
          </div>
        </div>

        {/* Results */}
        {result && (
          <div>
            {result.type === 'single' && (
              <div>
                {/* Stats */}
                <div style={{
                  display:"grid",
                  gridTemplateColumns:"repeat(auto-fit, minmax(200px, 1fr))",
                  gap:16,
                  marginBottom:24
                }}>
                  {[
                    { label: "Total Rules", value: result.data.stats.totalRules, color: "#6b7280" },
                    { label: "Passed", value: result.data.stats.passed, color: "#10b981" },
                    { label: "Failed", value: result.data.stats.failed, color: result.data.stats.failed > 0 ? "#ef4444" : "#10b981" },
                    { label: "Complexity", value: result.data.stats.complexity, color: "#8b5cf6" }
                  ].map((stat, i) => (
                    <div key={i} style={{
                      padding:20,
                      background:"rgba(255,255,255,0.03)",
                      border:"1px solid rgba(255,255,255,0.1)",
                      borderRadius:8
                    }}>
                      <div style={{ fontSize:12, color:"#6b7280", marginBottom:8, fontWeight:500, textTransform:"uppercase", letterSpacing:"0.5px" }}>
                        {stat.label}
                      </div>
                      <div style={{ fontSize:32, fontWeight:700, color: stat.color }}>
                        {stat.value}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Export and Controls */}
                <div style={{ display:"flex", justifyContent:"flex-end", gap:12, marginBottom:16 }}>
                  <button
                    onClick={handleExportPDF}
                    style={{
                      padding:"10px 20px",
                      background:"rgba(16, 185, 129, 0.1)",
                      border:"1px solid rgba(16, 185, 129, 0.3)",
                      borderRadius:6,
                      color:"#10b981",
                      fontSize:13,
                      fontWeight:500,
                      cursor:"pointer",
                      transition:"all 0.2s ease",
                      fontFamily:"inherit"
                    }}
                    onMouseOver={(e) => e.target.style.background = "rgba(16, 185, 129, 0.15)"}
                    onMouseOut={(e) => e.target.style.background = "rgba(16, 185, 129, 0.1)"}
                  >
                    Export PDF
                  </button>
                </div>

                {/* Failed rules */}
                {result.data.flags.length > 0 && (
                  <div style={{ marginBottom:24 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                      <h3 style={{ fontSize:20, fontWeight:600, margin:0, color:"#ffffff" }}>
                        Issues Found ({result.data.flags.length})
                      </h3>
                      <button
                        onClick={() => setBeginnerMode(!beginnerMode)}
                        style={{
                          padding:"8px 16px",
                          background: beginnerMode ? "rgba(59, 130, 246, 0.15)" : "rgba(255,255,255,0.05)",
                          border: beginnerMode ? "1px solid rgba(59, 130, 246, 0.3)" : "1px solid rgba(255,255,255,0.1)",
                          borderRadius:6,
                          color: beginnerMode ? "#60a5fa" : "#9ca3af",
                          fontSize:13,
                          fontWeight:500,
                          cursor:"pointer",
                          transition:"all 0.2s ease",
                          fontFamily:"inherit"
                        }}
                        onMouseOver={(e) => {
                          e.target.style.background = beginnerMode ? "rgba(59, 130, 246, 0.2)" : "rgba(255,255,255,0.08)";
                        }}
                        onMouseOut={(e) => {
                          e.target.style.background = beginnerMode ? "rgba(59, 130, 246, 0.15)" : "rgba(255,255,255,0.05)";
                        }}
                      >
                        {beginnerMode ? "✓ " : ""}Beginner Mode
                      </button>
                    </div>
                    {[...result.data.flags].sort((a, b) => calculateImpactScore(b) - calculateImpactScore(a)).map((flag, i) => {
                      const colors = SEVERITY_COLORS[flag.severity];
                      return (
                        <div key={i} style={{
                          padding:20,
                          marginBottom:12,
                          background: colors.bg,
                          border:`1px solid ${colors.border}`,
                          borderRadius:8
                        }}>
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"start", marginBottom:12 }}>
                            <h4 style={{ fontSize:16, fontWeight:600, color:"#ffffff", margin:0 }}>
                              {flag.title}
                            </h4>
                            <div style={{
                              padding:"4px 10px",
                              borderRadius:4,
                              background: colors.badge,
                              color:"#ffffff",
                              fontSize:11,
                              fontWeight:600,
                              textTransform:"uppercase",
                              letterSpacing:"0.5px"
                            }}>
                              {flag.severity}
                            </div>
                          </div>
                          <p style={{ fontSize:14, lineHeight:1.6, color:"#d1d5db", margin:"0 0 12px 0" }}>
                            {flag.message}
                          </p>
                          {beginnerMode && (
                            <div style={{
                              marginBottom:12,
                              padding:16,
                              background:"rgba(59, 130, 246, 0.08)",
                              border:"1px solid rgba(59, 130, 246, 0.2)",
                              borderRadius:6
                            }}>
                              <div style={{ fontSize:13, fontWeight:600, color:"#60a5fa", marginBottom:8, textTransform:"uppercase", letterSpacing:"0.5px" }}>
                                Beginner Explanation
                              </div>
                              <div style={{ fontSize:14, lineHeight:1.6, color:"#e5e7eb", marginBottom:10 }}>
                                <strong style={{ color:"#ffffff" }}>What's happening:</strong> {getBeginnerExplanation(flag.id).simple}
                              </div>
                              <div style={{ fontSize:14, lineHeight:1.6, color:"#e5e7eb", marginBottom:10 }}>
                                <strong style={{ color:"#ffffff" }}>Impact:</strong> {getBeginnerExplanation(flag.id).impact}
                              </div>
                              <div style={{ fontSize:14, lineHeight:1.6, color:"#e5e7eb", marginBottom:10 }}>
                                <strong style={{ color:"#ffffff" }}>Think of it like:</strong> {getBeginnerExplanation(flag.id).analogy}
                              </div>
                              <div style={{ fontSize:14, lineHeight:1.6, color:"#e5e7eb" }}>
                                <strong style={{ color:"#10b981" }}>How to fix:</strong> {getBeginnerExplanation(flag.id).fix}
                              </div>
                            </div>
                          )}
                          {flag.hint && (
                            <div style={{
                              padding:12,
                              background:"rgba(0, 0, 0, 0.3)",
                              borderRadius:6,
                              fontSize:13,
                              color:"#9ca3af",
                              fontFamily:"'JetBrains Mono', monospace",
                              lineHeight:1.5
                            }}>
                              <strong style={{ color: colors.text }}>Hint:</strong> {flag.hint}
                            </div>
                          )}
                          {flag.complexity && (
                            <div style={{ marginTop:12, fontSize:12, color: colors.text, fontWeight:500 }}>
                              Time Complexity: {flag.complexity}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Passed rules */}
                {result.data.passed.length > 0 && (
                  <div>
                    <h3 style={{ fontSize:20, fontWeight:600, marginBottom:16, color:"#ffffff" }}>
                      Passed ({result.data.passed.length})
                    </h3>
                    <div style={{
                      padding:20,
                      background:"rgba(16, 185, 129, 0.05)",
                      border:"1px solid rgba(16, 185, 129, 0.2)",
                      borderRadius:8
                    }}>
                      <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                        {result.data.passed.map((rule, i) => (
                          <div key={i} style={{
                            padding:"6px 12px",
                            background:"rgba(16, 185, 129, 0.1)",
                            border:"1px solid rgba(16, 185, 129, 0.3)",
                            borderRadius:4,
                            fontSize:12,
                            color:"#10b981",
                            fontWeight:500
                          }}>
                            {rule.title}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {result.type === 'repository' && (
              <div>
                <h3 style={{ fontSize:24, fontWeight:600, marginBottom:16, color:"#ffffff" }}>
                  Repository Analysis: {result.data.repoName}
                </h3>
                <div style={{
                  padding:20,
                  marginBottom:16,
                  background:"rgba(255,255,255,0.03)",
                  border:"1px solid rgba(255,255,255,0.1)",
                  borderRadius:8
                }}>
                  <p style={{ fontSize:14, color:"#d1d5db", margin:0 }}>
                    Analyzed {result.data.results.length} files
                  </p>
                </div>

                {result.data.results.map((fileResult, i) => (
                  <div key={i} style={{
                    padding:20,
                    marginBottom:12,
                    background:"rgba(255,255,255,0.03)",
                    border:"1px solid rgba(255,255,255,0.1)",
                    borderRadius:8
                  }}>
                    <h4 style={{ fontSize:14, fontWeight:500, color:"#ffffff", marginBottom:8, fontFamily:"'JetBrains Mono', monospace" }}>
                      {fileResult.path}
                    </h4>
                    {fileResult.error ? (
                      <p style={{ color:"#ef4444", fontSize:14, margin:0 }}>
                        Error: {fileResult.error}
                      </p>
                    ) : (
                      <div style={{ display:"flex", gap:16, fontSize:14 }}>
                        <span style={{ color:"#10b981" }}>
                          ✓ {fileResult.analysis.stats.passed} passed
                        </span>
                        <span style={{ color: fileResult.analysis.stats.failed > 0 ? "#ef4444" : "#6b7280" }}>
                          {fileResult.analysis.stats.failed > 0 ? "✗" : "—"} {fileResult.analysis.stats.failed} failed
                        </span>
                        <span style={{ color:"#9ca3af" }}>
                          {fileResult.analysis.stats.complexity}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <footer style={{ marginTop:64, paddingTop:24, borderTop:"1px solid rgba(255,255,255,0.1)", textAlign:"center" }}>
          <p style={{ fontSize:13, color:"#6b7280", margin:0 }}>
            100% client-side · No data collection · Open source
          </p>
        </footer>
      </div>

      {/* Global styles */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');

        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          background: #0a0a0a;
        }

        ::-webkit-scrollbar {
          width: 10px;
        }

        ::-webkit-scrollbar-track {
          background: #0a0a0a;
        }

        ::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.1);
          border-radius: 5px;
        }

        ::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.2);
        }

        ::selection {
          background: rgba(59, 130, 246, 0.3);
          color: #ffffff;
        }

        textarea::-webkit-scrollbar {
          width: 8px;
        }

        textarea::-webkit-scrollbar-track {
          background: transparent;
        }

        textarea::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.1);
          border-radius: 4px;
        }

        button:active {
          transform: scale(0.98);
        }
      `}</style>
    </div>
  );
}

export default App;
