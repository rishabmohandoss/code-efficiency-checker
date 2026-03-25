import { useState, useRef, useCallback } from "react";
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

// ═══════════════════════════════════════════════════════════════════════════════
// RULE ENGINE — Pure local pattern matching, zero external dependencies
// Each rule: { id, title, severity, languages, test(lines, code, raw), message, hint }
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
    }

    // Exit loop tracking when depth drops below loop level
    // AND the line has actual content (not just whitespace/braces)
    if (inLoop && d < currentLoopDepth && line.trim().length > 0 && !/^[}\])]\s*$/.test(line.trim())) {
      inLoop = false;
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
    else if (!["linear-scan-in-loop", "alloc-in-loop", "sort-in-loop", "async-in-loop"].includes(rule.id)) {
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

// ── Placeholder text for empty textarea ──────────────────────────────────────
// (removed duplicate - now imported from constants.js)

// ── EXT_LANG Language Mappings ───────────────────────────────────────────────
// (removed duplicate - now imported from constants.js)

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
  CRITICAL: { bg:"#ef444418", border:"#ef444450", text:"#f87171", bar:"#ef4444" },
  HIGH:     { bg:"#f9731618", border:"#f9731650", text:"#fb923c", bar:"#f97316" },
  MEDIUM:   { bg:"#eab30818", border:"#eab30850", text:"#fbbf24", bar:"#eab308" },
  LOW:      { bg:"#6b728018", border:"#6b728050", text:"#9ca3af", bar:"#6b7280" },
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
  const [method, setMethod] = useState("paste"); // 'paste', 'upload', 'github'
  const [githubUrl, setGithubUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [repoProgress, setRepoProgress] = useState(null);
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
        // Cancel any previous request
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
          // Analyze entire repository
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
          // Single file
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

  return (
    <div style={{
      minHeight:"100vh",
      background:"#000000",
      color:"#e2e8f0",
      padding:"80px 24px",
      position:"relative",
      overflow:"hidden"
    }}>
      {/* Animated gradient mesh background */}
      <div style={{ position:"fixed", inset:0, zIndex:0, overflow:"hidden" }}>
        {/* Base gradient */}
        <div style={{
          position:"absolute", inset:0,
          background:"radial-gradient(circle at 50% 50%, rgba(17, 24, 39, 0.8) 0%, rgba(0, 0, 0, 1) 100%)",
        }}/>

        {/* Animated gradient orbs */}
        <div style={{
          position:"absolute", top:"-50%", left:"-20%",
          width:"100%", height:"100%",
          background:"radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, transparent 70%)",
          filter:"blur(60px)",
          animation:"mesh-1 20s ease-in-out infinite",
        }}/>

        <div style={{
          position:"absolute", bottom:"-50%", right:"-20%",
          width:"80%", height:"80%",
          background:"radial-gradient(circle, rgba(147, 51, 234, 0.15) 0%, transparent 70%)",
          filter:"blur(60px)",
          animation:"mesh-2 25s ease-in-out infinite",
        }}/>

        <div style={{
          position:"absolute", top:"20%", right:"10%",
          width:"60%", height:"60%",
          background:"radial-gradient(circle, rgba(16, 185, 129, 0.1) 0%, transparent 70%)",
          filter:"blur(80px)",
          animation:"mesh-3 30s ease-in-out infinite",
        }}/>

        {/* Floating geometric shapes */}
        {[...Array(5)].map((_, i) => (
          <div key={i} className="float" style={{
            position:"absolute",
            top:`${10 + i * 20}%`,
            left:`${5 + i * 15}%`,
            width:"400px",
            height:"400px",
            borderRadius:"30% 70% 70% 30% / 30% 30% 70% 70%",
            background:`radial-gradient(circle, rgba(${i % 2 === 0 ? '59, 130, 246' : '147, 51, 234'}, 0.05) 0%, transparent 70%)`,
            filter:"blur(40px)",
            animation:`float ${6 + i * 2}s ease-in-out infinite`,
            animationDelay:`${i * 0.5}s`,
          }}/>
        ))}

        {/* Scan line effect */}
        <div style={{
          position:"absolute",
          width:"100%",
          height:"2px",
          background:"linear-gradient(90deg, transparent, rgba(59, 130, 246, 0.5), transparent)",
          animation:"scan-line 8s linear infinite",
          opacity:0.3
        }}/>
      </div>

      {/* Content container */}
      <div style={{ maxWidth:920, margin:"0 auto", position:"relative", zIndex:1 }}>

        {/* Hero section */}
        <div className="fade-in" style={{ marginBottom:64, textAlign:"center" }}>
          {/* Glowing badge */}
          <div style={{
            display:"inline-flex",
            alignItems:"center",
            gap:8,
            padding:"8px 20px",
            marginBottom:24,
            background:"rgba(59, 130, 246, 0.08)",
            border:"1px solid rgba(59, 130, 246, 0.2)",
            borderRadius:50,
            fontSize:12,
            fontWeight:600,
            textTransform:"uppercase",
            letterSpacing:"0.05em",
            color:"rgba(96, 165, 250, 1)",
            boxShadow:"0 0 20px rgba(59, 130, 246, 0.15)",
          }}>
            <span style={{
              display:"inline-block",
              width:6,
              height:6,
              borderRadius:"50%",
              background:"rgba(96, 165, 250, 1)",
              animation:"pulse-glow 2s ease-in-out infinite",
            }}/>
            {RULES.length} Rules • Zero API Calls • 100% Client-Side
          </div>

          {/* Gradient title */}
          <h1 style={{
            fontSize:"clamp(42px, 8vw, 84px)",
            fontWeight:900,
            lineHeight:1.1,
            marginBottom:16,
            letterSpacing:"-0.04em",
            background:"linear-gradient(135deg, #ffffff 0%, rgba(255,255,255,0.6) 100%)",
            WebkitBackgroundClip:"text",
            WebkitTextFillColor:"transparent",
            backgroundClip:"text",
          }}>
            Code Efficiency<br/>
            <span style={{
              background:"linear-gradient(135deg, rgba(96, 165, 250, 1) 0%, rgba(147, 51, 234, 1) 100%)",
              WebkitBackgroundClip:"text",
              WebkitTextFillColor:"transparent",
              backgroundClip:"text",
            }}>Analyzer</span>
          </h1>

          <p style={{
            fontSize:"clamp(14px, 2vw, 18px)",
            lineHeight:1.6,
            color:"rgba(148, 163, 184, 1)",
            maxWidth:600,
            margin:"0 auto 32px",
          }}>
            Detect algorithmic bottlenecks, nested loops, and AI-generated code issues. Real-time analysis with zero server calls.
          </p>

          {/* Stats row */}
          <div style={{
            display:"flex",
            justifyContent:"center",
            gap:40,
            flexWrap:"wrap"
          }}>
            {[
              { label: "Languages", value: "10+" },
              { label: "Analysis", value: "Real-time" },
              { label: "Privacy", value: "100%" }
            ].map((stat, i) => (
              <div key={i} style={{ textAlign:"center" }}>
                <div style={{
                  fontSize:32,
                  fontWeight:700,
                  background:"linear-gradient(135deg, rgba(96, 165, 250, 1) 0%, rgba(147, 51, 234, 1) 100%)",
                  WebkitBackgroundClip:"text",
                  WebkitTextFillColor:"transparent",
                  backgroundClip:"text",
                  marginBottom:4
                }}>{stat.value}</div>
                <div style={{
                  fontSize:12,
                  textTransform:"uppercase",
                  letterSpacing:"0.05em",
                  color:"rgba(100, 116, 139, 1)",
                  fontWeight:600
                }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Input panel */}
        <div className="fade-in fade-in-delay-1 glass" style={{
          padding:32,
          borderRadius:16,
          marginBottom:24,
          background:"rgba(255, 255, 255, 0.03)",
          backdropFilter:"blur(20px) saturate(180%)",
          border:"1px solid rgba(255, 255, 255, 0.08)",
          boxShadow:"0 8px 32px rgba(0, 0, 0, 0.37)",
        }}>
          {/* Method tabs */}
          <div style={{ display:"flex", gap:8, marginBottom:24 }}>
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
                  padding:"12px 20px",
                  background: method === tab.id ? "rgba(59, 130, 246, 0.1)" : "transparent",
                  border: method === tab.id ? "1px solid rgba(59, 130, 246, 0.3)" : "1px solid rgba(255, 255, 255, 0.05)",
                  borderRadius:8,
                  color: method === tab.id ? "rgba(96, 165, 250, 1)" : "rgba(100, 116, 139, 1)",
                  fontSize:12,
                  fontWeight:600,
                  textTransform:"uppercase",
                  letterSpacing:"0.05em",
                  cursor:"pointer",
                  transition:"all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
                  fontFamily:"Inter, sans-serif",
                }}
              >{tab.label}</button>
            ))}
          </div>

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
                  background:"rgba(0, 0, 0, 0.4)",
                  border:"1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius:8,
                  color:"#e2e8f0",
                  fontSize:14,
                  fontFamily:"JetBrains Mono, monospace",
                  resize:"vertical",
                  marginBottom:16,
                  lineHeight:1.6
                }}
              />
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                style={{
                  padding:"12px 16px",
                  background:"rgba(0, 0, 0, 0.4)",
                  border:"1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius:8,
                  color:"#e2e8f0",
                  fontSize:14,
                  fontFamily:"Inter, sans-serif",
                  cursor:"pointer",
                  width:"100%"
                }}
              >
                {LANGUAGES.map(lang => (
                  <option key={lang} value={lang}>{LANGUAGES_DISPLAY[lang] || lang}</option>
                ))}
              </select>
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
                  borderRadius:8,
                  color:"rgba(96, 165, 250, 1)",
                  fontSize:16,
                  fontWeight:600,
                  cursor:"pointer",
                  transition:"all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
                  fontFamily:"Inter, sans-serif",
                }}
              >
                Click to upload file (max {MAX_FILE_SIZE / 1024 / 1024}MB)
              </button>
              {code && (
                <div style={{
                  marginTop:16,
                  padding:12,
                  background:"rgba(16, 185, 129, 0.1)",
                  border:"1px solid rgba(16, 185, 129, 0.3)",
                  borderRadius:8,
                  color:"rgba(16, 185, 129, 1)",
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
                placeholder="https://github.com/owner/repo/blob/main/file.js or https://github.com/owner/repo"
                style={{
                  width:"100%",
                  padding:"16px",
                  background:"rgba(0, 0, 0, 0.4)",
                  border:"1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius:8,
                  color:"#e2e8f0",
                  fontSize:14,
                  fontFamily:"JetBrains Mono, monospace",
                  marginBottom:8
                }}
              />
              <p style={{ fontSize:12, color:"rgba(148, 163, 184, 1)", margin:0 }}>
                Supports single files or entire repositories (analyzes up to {MAX_REPO_FILES} files)
              </p>
            </>
          )}

          {error && (
            <div style={{
              marginTop:16,
              padding:12,
              background:"rgba(239, 68, 68, 0.1)",
              border:"1px solid rgba(239, 68, 68, 0.3)",
              borderRadius:8,
              color:"rgba(248, 113, 113, 1)",
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
              marginTop:24,
              padding:"16px 32px",
              background: loading ? "rgba(100, 116, 139, 0.3)" : "linear-gradient(135deg, rgba(59, 130, 246, 1) 0%, rgba(147, 51, 234, 1) 100%)",
              border:"none",
              borderRadius:8,
              color:"#ffffff",
              fontSize:16,
              fontWeight:700,
              cursor: loading ? "not-allowed" : "pointer",
              transition:"all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
              boxShadow: loading ? "none" : "0 4px 20px rgba(59, 130, 246, 0.4)",
              fontFamily:"Inter, sans-serif",
              textTransform:"uppercase",
              letterSpacing:"0.05em",
              opacity: loading ? 0.5 : 1,
            }}
          >
            {loading ? (repoProgress ? `Analyzing ${repoProgress.current}/${repoProgress.total}...` : "Analyzing...") : "Analyze Code"}
          </button>
        </div>

        {/* Results section */}
        {result && (
          <div className="fade-in fade-in-delay-2">
            {result.type === 'single' && (
              <div>
                {/* Stats summary */}
                <div style={{
                  display:"grid",
                  gridTemplateColumns:"repeat(auto-fit, minmax(200px, 1fr))",
                  gap:16,
                  marginBottom:24
                }}>
                  {[
                    { label: "Total Rules", value: result.data.stats.totalRules, color: "rgba(100, 116, 139, 1)" },
                    { label: "Passed", value: result.data.stats.passed, color: "rgba(16, 185, 129, 1)" },
                    { label: "Failed", value: result.data.stats.failed, color: result.data.stats.failed > 0 ? "rgba(239, 68, 68, 1)" : "rgba(16, 185, 129, 1)" },
                    { label: "Complexity", value: result.data.stats.complexity, color: "rgba(147, 51, 234, 1)" }
                  ].map((stat, i) => (
                    <div key={i} className="glass" style={{
                      padding:20,
                      borderRadius:12,
                      background:"rgba(255, 255, 255, 0.03)",
                      backdropFilter:"blur(20px) saturate(180%)",
                      border:"1px solid rgba(255, 255, 255, 0.08)",
                      boxShadow:"0 8px 32px rgba(0, 0, 0, 0.37)",
                    }}>
                      <div style={{ fontSize:12, textTransform:"uppercase", letterSpacing:"0.05em", color:"rgba(148, 163, 184, 1)", marginBottom:8, fontWeight:600 }}>
                        {stat.label}
                      </div>
                      <div style={{ fontSize:32, fontWeight:700, color: stat.color }}>
                        {stat.value}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Failed rules */}
                {result.data.flags.length > 0 && (
                  <div style={{ marginBottom:24 }}>
                    <h3 style={{ fontSize:20, fontWeight:700, marginBottom:16, color:"#ffffff" }}>
                      Issues Found ({result.data.flags.length})
                    </h3>
                    {result.data.flags.map((flag, i) => {
                      const colors = SEVERITY_COLORS[flag.severity];
                      return (
                        <div key={i} className="glass" style={{
                          padding:20,
                          borderRadius:12,
                          marginBottom:12,
                          background: colors.bg,
                          backdropFilter:"blur(20px) saturate(180%)",
                          border:`1px solid ${colors.border}`,
                          boxShadow:"0 8px 32px rgba(0, 0, 0, 0.37)",
                        }}>
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"start", marginBottom:12 }}>
                            <h4 style={{ fontSize:16, fontWeight:600, color:"#ffffff", margin:0 }}>
                              {flag.title}
                            </h4>
                            <div style={{
                              padding:"4px 12px",
                              borderRadius:4,
                              background: colors.bar,
                              color:"#ffffff",
                              fontSize:11,
                              fontWeight:700,
                              textTransform:"uppercase",
                              letterSpacing:"0.05em"
                            }}>
                              {flag.severity}
                            </div>
                          </div>
                          <p style={{ fontSize:14, lineHeight:1.6, color:"rgba(203, 213, 225, 1)", margin:"0 0 12px 0" }}>
                            {flag.message}
                          </p>
                          {flag.hint && (
                            <div style={{
                              padding:12,
                              background:"rgba(0, 0, 0, 0.3)",
                              borderRadius:6,
                              fontSize:13,
                              color:"rgba(148, 163, 184, 1)",
                              fontFamily:"JetBrains Mono, monospace"
                            }}>
                              <strong style={{ color: colors.text }}>Hint:</strong> {flag.hint}
                            </div>
                          )}
                          {flag.complexity && (
                            <div style={{ marginTop:12, fontSize:12, color: colors.text, fontWeight:600 }}>
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
                    <h3 style={{ fontSize:20, fontWeight:700, marginBottom:16, color:"#ffffff" }}>
                      Passed ({result.data.passed.length})
                    </h3>
                    <div className="glass" style={{
                      padding:20,
                      borderRadius:12,
                      background:"rgba(16, 185, 129, 0.05)",
                      backdropFilter:"blur(20px) saturate(180%)",
                      border:"1px solid rgba(16, 185, 129, 0.2)",
                      boxShadow:"0 8px 32px rgba(0, 0, 0, 0.37)",
                    }}>
                      <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                        {result.data.passed.map((rule, i) => (
                          <div key={i} style={{
                            padding:"6px 12px",
                            background:"rgba(16, 185, 129, 0.1)",
                            border:"1px solid rgba(16, 185, 129, 0.3)",
                            borderRadius:6,
                            fontSize:12,
                            color:"rgba(16, 185, 129, 1)",
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
                <h3 style={{ fontSize:24, fontWeight:700, marginBottom:16, color:"#ffffff" }}>
                  Repository Analysis: {result.data.repoName}
                </h3>
                <div className="glass" style={{
                  padding:20,
                  borderRadius:12,
                  marginBottom:16,
                  background:"rgba(255, 255, 255, 0.03)",
                  backdropFilter:"blur(20px) saturate(180%)",
                  border:"1px solid rgba(255, 255, 255, 0.08)",
                  boxShadow:"0 8px 32px rgba(0, 0, 0, 0.37)",
                }}>
                  <p style={{ fontSize:14, color:"rgba(203, 213, 225, 1)", margin:0 }}>
                    Analyzed {result.data.results.length} files
                  </p>
                </div>

                {result.data.results.map((fileResult, i) => (
                  <div key={i} className="glass" style={{
                    padding:20,
                    borderRadius:12,
                    marginBottom:12,
                    background:"rgba(255, 255, 255, 0.03)",
                    backdropFilter:"blur(20px) saturate(180%)",
                    border:"1px solid rgba(255, 255, 255, 0.08)",
                    boxShadow:"0 8px 32px rgba(0, 0, 0, 0.37)",
                  }}>
                    <h4 style={{ fontSize:16, fontWeight:600, color:"#ffffff", marginBottom:8, fontFamily:"JetBrains Mono, monospace" }}>
                      {fileResult.path}
                    </h4>
                    {fileResult.error ? (
                      <p style={{ color:"rgba(248, 113, 113, 1)", fontSize:14 }}>
                        Error: {fileResult.error}
                      </p>
                    ) : (
                      <div style={{ display:"flex", gap:16, fontSize:14 }}>
                        <span style={{ color:"rgba(16, 185, 129, 1)" }}>
                          ✓ {fileResult.analysis.stats.passed} passed
                        </span>
                        <span style={{ color: fileResult.analysis.stats.failed > 0 ? "rgba(239, 68, 68, 1)" : "rgba(100, 116, 139, 1)" }}>
                          {fileResult.analysis.stats.failed > 0 ? "✗" : "—"} {fileResult.analysis.stats.failed} failed
                        </span>
                        <span style={{ color:"rgba(148, 163, 184, 1)" }}>
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
      </div>

      {/* Global styles */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap');

        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: 'Inter', sans-serif;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }

        ::-webkit-scrollbar {
          width: 8px;
        }

        ::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.3);
        }

        ::-webkit-scrollbar-thumb {
          background: rgba(59, 130, 246, 0.5);
          border-radius: 4px;
        }

        ::-webkit-scrollbar-thumb:hover {
          background: rgba(59, 130, 246, 0.7);
        }

        @keyframes fade-up {
          from {
            opacity: 0;
            transform: translateY(40px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .fade-in {
          animation: fade-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .fade-in-delay-1 {
          opacity: 0;
          animation: fade-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.2s forwards;
        }

        .fade-in-delay-2 {
          opacity: 0;
          animation: fade-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.4s forwards;
        }

        @keyframes float {
          0%, 100% {
            transform: translate(0, 0) rotate(0deg);
          }
          25% {
            transform: translate(10px, -10px) rotate(5deg);
          }
          50% {
            transform: translate(-10px, 10px) rotate(-5deg);
          }
          75% {
            transform: translate(10px, 10px) rotate(5deg);
          }
        }

        @keyframes mesh-1 {
          0%, 100% {
            transform: translate(0, 0) rotate(0deg);
          }
          50% {
            transform: translate(30%, 20%) rotate(180deg);
          }
        }

        @keyframes mesh-2 {
          0%, 100% {
            transform: translate(0, 0) rotate(0deg);
          }
          50% {
            transform: translate(-20%, 30%) rotate(-180deg);
          }
        }

        @keyframes mesh-3 {
          0%, 100% {
            transform: scale(1) rotate(0deg);
          }
          50% {
            transform: scale(1.2) rotate(90deg);
          }
        }

        @keyframes pulse-glow {
          0%, 100% {
            opacity: 1;
            box-shadow: 0 0 8px rgba(96, 165, 250, 0.8);
          }
          50% {
            opacity: 0.6;
            box-shadow: 0 0 16px rgba(96, 165, 250, 1);
          }
        }

        @keyframes scan-line {
          0% {
            transform: translateY(-100%);
          }
          100% {
            transform: translateY(100vh);
          }
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        button:hover:not(:disabled), select:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 24px rgba(59, 130, 246, 0.5);
        }

        .glass {
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .glass:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
          border-color: rgba(255, 255, 255, 0.12);
        }
      `}</style>
    </div>
  );
}

export default App;
