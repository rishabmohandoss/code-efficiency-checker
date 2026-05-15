import { useState, useRef, useCallback } from "react";
import { jsPDF } from "jspdf";
import { RULES } from './rules/index.js';

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
import { runAnalysis } from './analysis/engine.js';
import { runSecurityAnalysis, getBeginnerExplanation as getSecurityBeginnerExplanation } from './analysis/security-engine.js';
import { TextScramble } from './components/ui/text-scramble.jsx';
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

// ── Run engine (imported from src/analysis/engine.js) ─────────────────────────

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
async function analyzeGitHubRepository(info, onProgress, signal, analysisMode = "performance") {
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

      // Run either performance or security analysis
      const analysis = analysisMode === "security"
        ? runSecurityAnalysis(content, language)
        : runAnalysis(content, language);

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
  const [analysisMode, setAnalysisMode] = useState("performance"); // "performance" or "security"
  const fileInputRef = useRef(null);
  const abortControllerRef = useRef(null);

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
            signal,
            analysisMode
          );

          setResult({
            type: 'repository',
            data: repoResult,
            analysisMode: analysisMode
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

      // Run either performance or security analysis based on mode
      if (analysisMode === "security") {
        analysisResult = runSecurityAnalysis(sourceCode, language);
      } else {
        analysisResult = runAnalysis(sourceCode, language);
      }

      setResult({
        type: 'single',
        data: analysisResult,
        analysisMode: analysisMode
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
  }, [code, language, method, githubUrl, analysisMode]);

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

      if (result.analysisMode === 'security') {
        // Security mode stats
        addText(`Total Rules Checked: ${result.data.stats.rulesChecked || 0}`, 12);
        addText(`Critical Issues: ${result.data.stats.critical || 0}`, 12);
        addText(`High Issues: ${result.data.stats.high || 0}`, 12);
        addText(`Medium Issues: ${result.data.stats.medium || 0}`, 12);
        addText(`Low Issues: ${result.data.stats.low || 0}`, 12);
        addText(`Security Score: ${result.data.securityScore || 0}/100`, 12);
      } else {
        // Performance mode stats
        addText(`Total Rules Checked: ${result.data.stats.totalRules}`, 12);
        addText(`Passed: ${result.data.stats.passed}`, 12);
        addText(`Failed: ${result.data.stats.failed}`, 12);
        addText(`Worst Complexity: ${result.data.stats.complexity}`, 12);
      }
      addSpacing(10);

      // Issues
      const issues = result.analysisMode === 'security' ? result.data.allIssues || [] : result.data.flags || [];
      if (issues.length > 0) {
        addText(`Issues Found (${issues.length})`, 16, true);
        addSpacing(5);

        const sortedFlags = [...issues].sort((a, b) =>
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
            const explanation = result.analysisMode === 'security'
              ? getSecurityBeginnerExplanation(flag.id)
              : getBeginnerExplanation(flag.id);

            if (explanation) {
              addSpacing(3);
              addText("Beginner Explanation:", 9, true);
              addText(`What's happening: ${explanation.what || explanation.simple}`, 8);
              addText(`Impact: ${explanation.impact}`, 8);
              addText(`Fix: ${explanation.fix}`, 8);
            }
          }

          addSpacing(8);
        });
      }

      // Passed rules (performance mode only)
      if (result.analysisMode !== 'security' && result.data.passed && result.data.passed.length > 0) {
        addText(`Passed Rules (${result.data.passed.length})`, 16, true);
        result.data.passed.forEach((rule, i) => {
          if (i > 0 && i % 3 === 0) addSpacing(2);
          addText(`• ${rule.title}`, 9);
        });
      }
    } else if (result.type === 'repository') {
      addText(`Repository Analysis: ${result.data.repoName}`, 16, true);
      addText(`Files Analyzed: ${result.data.results.length}`, 12);
      addText(`Analysis Mode: ${result.analysisMode === 'security' ? 'Security' : 'Performance'}`, 12);
      addSpacing(10);

      // Aggregate statistics
      const aggregated = result.data.results.reduce((acc, file) => {
        if (!file.error && file.analysis) {
          acc.totalFailed += file.analysis.stats.failed || 0;
          acc.filesAnalyzed += 1;

          // Handle both security (allIssues) and performance (flags) modes
          const issues = file.analysis.allIssues || file.analysis.flags || [];
          issues.forEach(flag => {
            const key = flag.id;
            if (!acc.flagsMap.has(key)) {
              acc.flagsMap.set(key, { ...flag, files: [] });
            }
            acc.flagsMap.get(key).files.push(file.path);
          });

          // Track severity breakdown for security mode
          if (result.analysisMode === 'security' && file.analysis.stats) {
            acc.critical += file.analysis.stats.critical || 0;
            acc.high += file.analysis.stats.high || 0;
            acc.medium += file.analysis.stats.medium || 0;
            acc.low += file.analysis.stats.low || 0;
          }
        }
        return acc;
      }, { totalFailed: 0, filesAnalyzed: 0, flagsMap: new Map(), critical: 0, high: 0, medium: 0, low: 0 });

      const aggregatedFlags = Array.from(aggregated.flagsMap.values());

      addText(`Unique Issues Found: ${aggregatedFlags.length}`, 12);
      if (result.analysisMode === 'security') {
        addText(`Critical Issues: ${aggregated.critical}`, 12);
        addText(`High Issues: ${aggregated.high}`, 12);
        addText(`Medium Issues: ${aggregated.medium}`, 12);
        addText(`Low Issues: ${aggregated.low}`, 12);
      } else {
        addText(`Total Flags: ${aggregated.totalFailed}`, 12);
      }
      addSpacing(10);

      // Show aggregated issues
      if (aggregatedFlags.length > 0) {
        addText(`Issues Found Across Repository (${aggregatedFlags.length} unique)`, 16, true);
        addSpacing(5);

        const sortedFlags = [...aggregatedFlags].sort((a, b) =>
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

          addText(`Found in ${flag.files.length} file(s): ${flag.files.slice(0, 3).map(f => f.split('/').pop()).join(', ')}${flag.files.length > 3 ? ` +${flag.files.length - 3} more` : ''}`, 8);

          if (beginnerMode) {
            const explanation = result.analysisMode === 'security'
              ? getSecurityBeginnerExplanation(flag.id)
              : getBeginnerExplanation(flag.id);

            if (explanation) {
              addSpacing(3);
              addText("Beginner Explanation:", 9, true);
              addText(`What's happening: ${explanation.what || explanation.simple}`, 8);
              addText(`Impact: ${explanation.impact}`, 8);
              addText(`Fix: ${explanation.fix}`, 8);
            }
          }

          addSpacing(8);
        });
      }

      // File summary
      addText(`Files Summary (${result.data.results.length} files)`, 16, true);
      addSpacing(5);
      result.data.results.forEach((fileResult, i) => {
        if (i > 0 && i % 5 === 0) addSpacing(3);
        if (fileResult.error) {
          addText(`${i + 1}. ${fileResult.path} - Error: ${fileResult.error}`, 9);
        } else {
          if (result.analysisMode === 'security') {
            const stats = fileResult.analysis.stats || {};
            addText(`${i + 1}. ${fileResult.path} - Critical: ${stats.critical || 0} | High: ${stats.high || 0} | Score: ${fileResult.analysis.securityScore || 0}/100`, 9);
          } else {
            addText(`${i + 1}. ${fileResult.path} - Passed: ${fileResult.analysis.stats.passed || 0} | Failed: ${fileResult.analysis.stats.failed || 0}`, 9);
          }
        }
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

  return (
    <div style={{
      minHeight:"100vh",
      background:"#000000",
      color:"#e5e7eb",
      fontFamily:"'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      {/* Content */}
      <div style={{ position:"relative", zIndex:1, maxWidth:1200, margin:"0 auto", padding:"40px 24px" }}>

        {/* Header */}
        <header style={{ marginBottom:56, display:"flex", flexDirection:"column", alignItems:"center", textAlign:"center" }}>
          <TextScramble
            text="ometa*N"
            className="text-5xl font-semibold mb-12"
          />

          <div style={{
            display:"inline-flex",
            alignItems:"center",
            gap:6,
            padding:"5px 16px",
            background:"rgba(59, 130, 246, 0.07)",
            border:"1px solid rgba(59, 130, 246, 0.15)",
            borderRadius:99,
            fontSize:11,
            fontWeight:600,
            color:"#60a5fa",
            marginBottom:20,
            letterSpacing:"1.2px",
            textTransform:"uppercase"
          }}>
            {RULES.length} Rules · Client-Side · Privacy-First
          </div>

          <p style={{
            fontSize:16,
            color:"#9ca3af",
            margin:0,
            maxWidth:500,
            lineHeight:1.75
          }}>
            Detect algorithmic inefficiencies and AI-generated code issues — 100% client-side, zero data collection.
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

            {/* Analysis Mode Toggle */}
            <div style={{
              marginTop:24,
              padding:16,
              background:"rgba(0,0,0,0.3)",
              border:"1px solid rgba(255,255,255,0.1)",
              borderRadius:6
            }}>
              <div style={{ marginBottom:12, fontSize:14, fontWeight:500, color:"#e5e7eb" }}>
                Analysis Mode:
              </div>
              <div style={{ display:"flex", gap:12 }}>
                <button
                  onClick={() => setAnalysisMode("performance")}
                  style={{
                    flex:1,
                    padding:"12px 16px",
                    background: analysisMode === "performance" ? "rgba(16, 185, 129, 0.15)" : "rgba(255,255,255,0.05)",
                    border: analysisMode === "performance" ? "1px solid rgba(16, 185, 129, 0.4)" : "1px solid rgba(255,255,255,0.1)",
                    borderRadius:6,
                    color: analysisMode === "performance" ? "#10b981" : "#9ca3af",
                    fontSize:14,
                    fontWeight:500,
                    cursor:"pointer",
                    transition:"all 0.2s ease",
                    fontFamily:"inherit"
                  }}
                  onMouseOver={(e) => {
                    if (analysisMode !== "performance") {
                      e.target.style.background = "rgba(255,255,255,0.08)";
                    }
                  }}
                  onMouseOut={(e) => {
                    if (analysisMode !== "performance") {
                      e.target.style.background = "rgba(255,255,255,0.05)";
                    }
                  }}
                >
                  ⚡ Performance
                </button>
                <button
                  onClick={() => setAnalysisMode("security")}
                  style={{
                    flex:1,
                    padding:"12px 16px",
                    background: analysisMode === "security" ? "rgba(239, 68, 68, 0.15)" : "rgba(255,255,255,0.05)",
                    border: analysisMode === "security" ? "1px solid rgba(239, 68, 68, 0.4)" : "1px solid rgba(255,255,255,0.1)",
                    borderRadius:6,
                    color: analysisMode === "security" ? "#ef4444" : "#9ca3af",
                    fontSize:14,
                    fontWeight:500,
                    cursor:"pointer",
                    transition:"all 0.2s ease",
                    fontFamily:"inherit"
                  }}
                  onMouseOver={(e) => {
                    if (analysisMode !== "security") {
                      e.target.style.background = "rgba(255,255,255,0.08)";
                    }
                  }}
                  onMouseOut={(e) => {
                    if (analysisMode !== "security") {
                      e.target.style.background = "rgba(255,255,255,0.05)";
                    }
                  }}
                >
                  🛡️ Security
                </button>
              </div>
              <p style={{
                fontSize:12,
                color:"#6b7280",
                margin:"12px 0 0 0",
                lineHeight:1.5
              }}>
                {analysisMode === "performance"
                  ? "Detects performance issues like nested loops, O(n²) complexity, and inefficient patterns."
                  : "Detects security vulnerabilities like hardcoded secrets, SQL injection, XSS, and OWASP Top 10 issues."}
              </p>
            </div>

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
                  {result.analysisMode === "security" ? (
                    // Security Stats
                    [
                      { label: "Critical", value: result.data.stats.critical, color: result.data.stats.critical > 0 ? "#ef4444" : "#6b7280" },
                      { label: "High", value: result.data.stats.high, color: result.data.stats.high > 0 ? "#f97316" : "#6b7280" },
                      { label: "Medium", value: result.data.stats.medium, color: result.data.stats.medium > 0 ? "#eab308" : "#6b7280" },
                      { label: "Low", value: result.data.stats.low, color: result.data.stats.low > 0 ? "#9ca3af" : "#6b7280" },
                      {
                        label: "Security Score",
                        value: result.data.securityScore + "/100",
                        color: result.data.securityScore >= 80 ? "#10b981" : result.data.securityScore >= 50 ? "#eab308" : "#ef4444"
                      }
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
                    ))
                  ) : (
                    // Performance Stats
                    [
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
                    ))
                  )}
                </div>

                {/* Deployment Readiness (Security mode only) */}
                {result.analysisMode === "security" && (
                  <div style={{
                    marginBottom:24,
                    padding:20,
                    background: result.data.deploymentReady ? "rgba(16, 185, 129, 0.08)" : "rgba(239, 68, 68, 0.08)",
                    border: result.data.deploymentReady ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid rgba(239, 68, 68, 0.3)",
                    borderRadius:8
                  }}>
                    <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:12 }}>
                      <div style={{
                        fontSize:36,
                        lineHeight:1
                      }}>
                        {result.data.deploymentReady ? "✅" : "⚠️"}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:18, fontWeight:600, color:"#ffffff", marginBottom:4 }}>
                          {result.data.deploymentReady ? "Ready to Deploy" : "NOT Ready to Deploy"}
                        </div>
                        <div style={{ fontSize:14, color:"#9ca3af" }}>
                          {result.data.deploymentReady
                            ? "No critical security issues detected. Your code passes all essential security checks."
                            : `${result.data.stats.critical} critical issue${result.data.stats.critical > 1 ? 's' : ''} must be fixed before deployment.`}
                        </div>
                      </div>
                    </div>
                    <div style={{
                      padding:"12px 16px",
                      background:"rgba(0,0,0,0.2)",
                      borderRadius:6,
                      fontSize:13,
                      color:"#d1d5db"
                    }}>
                      <strong>Security Score: {result.data.securityScore}/100</strong> —
                      {result.data.securityScore >= 80 ? " Excellent security posture" :
                       result.data.securityScore >= 50 ? " Needs improvement" :
                       " Critical vulnerabilities present"}
                    </div>
                  </div>
                )}

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

                {/* Failed rules / Security Issues */}
                {((result.analysisMode === "security" && result.data.allIssues?.length > 0) ||
                  (result.analysisMode !== "security" && result.data.flags?.length > 0)) && (
                  <div style={{ marginBottom:24 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                      <h3 style={{ fontSize:20, fontWeight:600, margin:0, color:"#ffffff" }}>
                        {result.analysisMode === "security" ? "Security Issues" : "Issues Found"} ({result.analysisMode === "security" ? result.data.allIssues.length : result.data.flags.length})
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
                    {(result.analysisMode === "security"
                      ? [...result.data.allIssues]
                      : [...result.data.flags].sort((a, b) => calculateImpactScore(b) - calculateImpactScore(a))
                    ).map((flag, i) => {
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
                          {beginnerMode && (() => {
                            const explanation = result.analysisMode === "security"
                              ? getSecurityBeginnerExplanation(flag.id)
                              : getBeginnerExplanation(flag.id);

                            if (!explanation) return null;

                            return (
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
                                  <strong style={{ color:"#ffffff" }}>What's happening:</strong> {explanation.what || explanation.simple}
                                </div>
                                <div style={{ fontSize:14, lineHeight:1.6, color:"#e5e7eb", marginBottom:10 }}>
                                  <strong style={{ color:"#ffffff" }}>Impact:</strong> {explanation.impact}
                                </div>
                                <div style={{ fontSize:14, lineHeight:1.6, color:"#e5e7eb", marginBottom:10 }}>
                                  <strong style={{ color:"#ffffff" }}>Think of it like:</strong> {explanation.analogy}
                                </div>
                                <div style={{ fontSize:14, lineHeight:1.6, color:"#e5e7eb" }}>
                                  <strong style={{ color:"#10b981" }}>How to fix:</strong> {explanation.fix}
                                </div>
                              </div>
                            );
                          })()}
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

                {/* Passed rules (Performance mode only) */}
                {result.analysisMode !== "security" && result.data.passed?.length > 0 && (
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
                {/* Repository Header */}
                <h3 style={{ fontSize:24, fontWeight:600, marginBottom:24, color:"#ffffff" }}>
                  Repository Analysis: {result.data.repoName}
                </h3>

                {/* Aggregate Statistics */}
                {(() => {
                  const aggregated = result.data.results.reduce((acc, file) => {
                    if (!file.error && file.analysis) {
                      acc.totalPassed += file.analysis.stats.passed || 0;
                      acc.totalFailed += file.analysis.stats.failed || 0;
                      acc.filesAnalyzed += 1;

                      // Collect all unique flags/issues (handle both performance and security mode)
                      const issues = file.analysis.allIssues || file.analysis.flags || [];
                      issues.forEach(flag => {
                        const key = flag.id;
                        if (!acc.flagsMap.has(key)) {
                          acc.flagsMap.set(key, { ...flag, files: [] });
                        }
                        acc.flagsMap.get(key).files.push(file.path);
                      });

                      // Track worst complexity (performance mode only)
                      if (file.analysis.stats.complexity) {
                        const complexityScores = { 'O(2ⁿ) worst': 10, 'O(n³)': 9, 'O(n² log n)': 7, 'O(n²)': 6, 'O(n log n)': 3, 'O(n)': 1 };
                        const score = complexityScores[file.analysis.stats.complexity] || 0;
                        if (score > acc.worstComplexityScore) {
                          acc.worstComplexityScore = score;
                          acc.worstComplexity = file.analysis.stats.complexity;
                        }
                      }
                    }
                    return acc;
                  }, { totalPassed: 0, totalFailed: 0, filesAnalyzed: 0, flagsMap: new Map(), worstComplexity: 'O(n)', worstComplexityScore: 0 });

                  const aggregatedFlags = Array.from(aggregated.flagsMap.values());
                  const uniqueIssues = aggregatedFlags.length;

                  // Calculate severity breakdown for security mode
                  const severityBreakdown = result.analysisMode === "security" ? {
                    critical: aggregatedFlags.filter(f => f.severity === 'CRITICAL').length,
                    high: aggregatedFlags.filter(f => f.severity === 'HIGH').length,
                    medium: aggregatedFlags.filter(f => f.severity === 'MEDIUM').length,
                    low: aggregatedFlags.filter(f => f.severity === 'LOW').length
                  } : null;

                  return (
                    <>
                      {/* Stats Grid */}
                      <div style={{
                        display:"grid",
                        gridTemplateColumns:"repeat(auto-fit, minmax(200px, 1fr))",
                        gap:16,
                        marginBottom:24
                      }}>
                        {(result.analysisMode === "security" ? [
                          { label: "Files Analyzed", value: aggregated.filesAnalyzed, color: "#6b7280" },
                          { label: "Critical Issues", value: severityBreakdown.critical, color: severityBreakdown.critical > 0 ? "#ef4444" : "#6b7280" },
                          { label: "High Issues", value: severityBreakdown.high, color: severityBreakdown.high > 0 ? "#f97316" : "#6b7280" },
                          { label: "Total Issues", value: uniqueIssues, color: uniqueIssues > 0 ? "#ef4444" : "#10b981" }
                        ] : [
                          { label: "Files Analyzed", value: aggregated.filesAnalyzed, color: "#6b7280" },
                          { label: "Unique Issues", value: uniqueIssues, color: uniqueIssues > 0 ? "#ef4444" : "#10b981" },
                          { label: "Total Flags", value: aggregated.totalFailed, color: aggregated.totalFailed > 0 ? "#ef4444" : "#10b981" },
                          { label: "Worst Complexity", value: aggregated.worstComplexity, color: "#8b5cf6" }
                        ]).map((stat, i) => (
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

                      {/* Unique Issues Found */}
                      {uniqueIssues > 0 && (
                        <div style={{ marginBottom:24 }}>
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                            <h3 style={{ fontSize:20, fontWeight:600, margin:0, color:"#ffffff" }}>
                              Issues Found Across Repository ({uniqueIssues} unique)
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

                          {[...aggregatedFlags].sort((a, b) => calculateImpactScore(b) - calculateImpactScore(a)).map((flag, i) => {
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
                                {beginnerMode && (() => {
                                  const explanation = result.analysisMode === "security"
                                    ? getSecurityBeginnerExplanation(flag.id)
                                    : getBeginnerExplanation(flag.id);

                                  if (!explanation) return null;

                                  return (
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
                                        <strong style={{ color:"#ffffff" }}>What's happening:</strong> {explanation.what || explanation.simple}
                                      </div>
                                      <div style={{ fontSize:14, lineHeight:1.6, color:"#e5e7eb", marginBottom:10 }}>
                                        <strong style={{ color:"#ffffff" }}>Impact:</strong> {explanation.impact}
                                      </div>
                                      <div style={{ fontSize:14, lineHeight:1.6, color:"#e5e7eb", marginBottom:10 }}>
                                        <strong style={{ color:"#ffffff" }}>Think of it like:</strong> {explanation.analogy}
                                      </div>
                                      <div style={{ fontSize:14, lineHeight:1.6, color:"#e5e7eb" }}>
                                        <strong style={{ color:"#10b981" }}>How to fix:</strong> {explanation.fix}
                                      </div>
                                    </div>
                                  );
                                })()}
                                {flag.hint && (
                                  <div style={{
                                    padding:12,
                                    background:"rgba(0, 0, 0, 0.3)",
                                    borderRadius:6,
                                    fontSize:13,
                                    color:"#9ca3af",
                                    fontFamily:"'JetBrains Mono', monospace",
                                    lineHeight:1.5,
                                    marginBottom:12
                                  }}>
                                    <strong style={{ color: colors.text }}>Hint:</strong> {flag.hint}
                                  </div>
                                )}
                                {flag.complexity && (
                                  <div style={{ fontSize:12, color: colors.text, fontWeight:500, marginBottom:12 }}>
                                    Time Complexity: {flag.complexity}
                                  </div>
                                )}
                                {/* Show affected files */}
                                <div style={{
                                  marginTop:12,
                                  padding:12,
                                  background:"rgba(0, 0, 0, 0.2)",
                                  borderRadius:6,
                                  fontSize:12
                                }}>
                                  <strong style={{ color:"#9ca3af" }}>Found in {flag.files.length} file{flag.files.length > 1 ? 's' : ''}:</strong>
                                  <div style={{ marginTop:8, display:"flex", flexWrap:"wrap", gap:6 }}>
                                    {flag.files.slice(0, 5).map((file, fi) => (
                                      <div key={fi} style={{
                                        padding:"4px 8px",
                                        background:"rgba(255,255,255,0.05)",
                                        border:"1px solid rgba(255,255,255,0.1)",
                                        borderRadius:4,
                                        color:"#e5e7eb",
                                        fontSize:11,
                                        fontFamily:"'JetBrains Mono', monospace"
                                      }}>
                                        {file.split('/').pop()}
                                      </div>
                                    ))}
                                    {flag.files.length > 5 && (
                                      <div style={{
                                        padding:"4px 8px",
                                        color:"#9ca3af",
                                        fontSize:11
                                      }}>
                                        +{flag.files.length - 5} more
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Files Summary - Collapsible */}
                      <div style={{ marginBottom:24 }}>
                        <h3 style={{ fontSize:20, fontWeight:600, marginBottom:16, color:"#ffffff" }}>
                          Files Analyzed ({result.data.results.length})
                        </h3>
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
                                {result.analysisMode === "security" ? (
                                  <>
                                    <span style={{ color: fileResult.analysis.stats.critical > 0 ? "#ef4444" : "#6b7280" }}>
                                      {fileResult.analysis.stats.critical > 0 ? "🔴" : "—"} {fileResult.analysis.stats.critical} critical
                                    </span>
                                    <span style={{ color: fileResult.analysis.stats.high > 0 ? "#f97316" : "#6b7280" }}>
                                      {fileResult.analysis.stats.high > 0 ? "🟠" : "—"} {fileResult.analysis.stats.high} high
                                    </span>
                                    <span style={{ color:"#9ca3af" }}>
                                      Score: {fileResult.analysis.securityScore || 0}/100
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <span style={{ color:"#10b981" }}>
                                      ✓ {fileResult.analysis.stats.passed || 0} passed
                                    </span>
                                    <span style={{ color: fileResult.analysis.stats.failed > 0 ? "#ef4444" : "#6b7280" }}>
                                      {fileResult.analysis.stats.failed > 0 ? "✗" : "—"} {fileResult.analysis.stats.failed} failed
                                    </span>
                                    {fileResult.analysis.stats.complexity && (
                                      <span style={{ color:"#9ca3af" }}>
                                        {fileResult.analysis.stats.complexity}
                                      </span>
                                    )}
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </>
                  );
                })()}
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
