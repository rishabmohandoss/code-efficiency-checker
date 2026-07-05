/**
 * Security Analysis Engine
 * Detects deployment security vulnerabilities, secrets, and OWASP Top 10 issues
 */

// Severity levels
const SEVERITY = {
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW'
};

/**
 * Safely test a regex against a string.
 * Regexes with the /g or /y flag are stateful: .test() advances lastIndex,
 * so reusing the same pattern object across lines silently skips matches
 * (every other identical line would return false). Resetting lastIndex
 * before each test makes reused patterns behave correctly.
 */
function safeTest(pattern, str) {
  pattern.lastIndex = 0;
  return pattern.test(str);
}

// Helper to create security issue
function createIssue(id, severity, title, message, hint, line = null, category = 'Security') {
  return {
    id,
    severity,
    title,
    message,
    hint,
    line,
    category,
    impact: calculateImpact(severity)
  };
}

// Calculate impact score for prioritization
function calculateImpact(severity) {
  const scores = {
    CRITICAL: 10,
    HIGH: 7,
    MEDIUM: 4,
    LOW: 2
  };
  return scores[severity] || 1;
}

/**
 * Main security analysis function
 * @param {string} code - Source code to analyze
 * @param {string} language - Programming language
 * @returns {object} Analysis results with security issues
 */
export function runSecurityAnalysis(code, language = 'javascript') {
  const results = {
    critical: [],
    high: [],
    medium: [],
    low: [],
    allIssues: [],
    stats: {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      total: 0,
      rulesChecked: 0
    },
    deploymentReady: false,
    securityScore: 100
  };

  const lines = code.split('\n');

  // Run all security checks
  detectSecrets(code, lines, results, language);
  detectOWASP(code, lines, results, language);
  detectAuthIssues(code, lines, results, language);
  detectDataProtection(code, lines, results, language);
  detectEnvironmentVariables(code, lines, results, language);
  detectConfigurationIssues(code, lines, results, language);
  detectDependencyIssues(code, lines, results, language);
  detectCICDIssues(code, lines, results, language);
  detectCodeQualityPerformance(code, lines, results, language);
  detectInfrastructureCloudSecurity(code, lines, results, language);

  // Calculate final stats
  results.stats.critical = results.critical.length;
  results.stats.high = results.high.length;
  results.stats.medium = results.medium.length;
  results.stats.low = results.low.length;
  results.stats.total = results.allIssues.length;

  // Deployment readiness: no critical issues
  results.deploymentReady = results.critical.length === 0;

  // Security score: 100 - (critical*10 + high*5 + medium*2 + low*1)
  results.securityScore = Math.max(0, 100 - (
    results.critical.length * 10 +
    results.high.length * 5 +
    results.medium.length * 2 +
    results.low.length * 1
  ));

  return results;
}

/**
 * Category 1: Secret & Credential Detection (Rules 1-10)
 */
function detectSecrets(code, lines, results, language) {
  const issues = [];

  // Rule 1: Hardcoded API Keys
  const apiKeyPatterns = [
    { pattern: /(?:api[_-]?key|apikey|api[_-]?secret)\s*[=:]\s*["']([a-zA-Z0-9_\-]{20,})["']/gi, name: 'API Key' },
    { pattern: /sk_live_[a-zA-Z0-9]{20,}/g, name: 'Stripe Live Key' },
    { pattern: /sk_test_[a-zA-Z0-9]{20,}/g, name: 'Stripe Test Key' },
    { pattern: /pk_live_[a-zA-Z0-9]{20,}/g, name: 'Stripe Publishable Key' },
    { pattern: /AKIA[0-9A-Z]{16}/g, name: 'AWS Access Key' },
    { pattern: /AIza[0-9A-Za-z_-]{35}/g, name: 'Google API Key' },
    { pattern: /sk-[a-zA-Z0-9]{32,}/g, name: 'OpenAI API Key' },
    { pattern: /ghp_[a-zA-Z0-9]{36,}/g, name: 'GitHub Personal Token' },
    { pattern: /xoxb-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24,}/g, name: 'Slack Bot Token' }
  ];

  lines.forEach((line, index) => {
    apiKeyPatterns.forEach(({ pattern, name }) => {
      const matches = line.match(pattern);
      if (matches) {
        const issue = createIssue(
          'hardcoded-api-key',
          SEVERITY.CRITICAL,
          `Hardcoded ${name} Detected`,
          `Your code contains a hardcoded ${name}. This is a critical security risk - if your repository is public or gets compromised, attackers can use this key to access your services, potentially causing financial damage or data breaches.`,
          `Move this key to an environment variable: process.env.API_KEY (JavaScript) or os.getenv('API_KEY') (Python). Never commit sensitive credentials to version control.`,
          index + 1,
          'Secrets'
        );
        issues.push(issue);
      }
    });
  });

  // Rule 2: Hardcoded Passwords
  const passwordPatterns = [
    /(?:password|passwd|pwd)\s*[=:]\s*["'](?!.*process\.env)([^"']{3,})["']/gi,
    /(?:pass|password)\s*:\s*["'](?!.*process\.env)([^"']{3,})["']/gi
  ];

  lines.forEach((line, index) => {
    // Skip if it's using environment variables
    if (line.includes('process.env') || line.includes('os.getenv') || line.includes('System.getenv')) {
      return;
    }

    passwordPatterns.forEach(pattern => {
      if (safeTest(pattern, line)) {
        const issue = createIssue(
          'hardcoded-password',
          SEVERITY.CRITICAL,
          'Hardcoded Password Detected',
          'Your code contains a hardcoded password. This is extremely dangerous - anyone with access to your code can see the password and gain unauthorized access to your systems.',
          'Use environment variables (process.env.DB_PASSWORD) or a secrets manager (AWS Secrets Manager, HashiCorp Vault) to store passwords securely.',
          index + 1,
          'Secrets'
        );
        issues.push(issue);
      }
    });
  });

  // Rule 3: Database Connection Strings
  const dbConnectionPatterns = [
    /(?:mongodb|postgres|mysql|postgresql):\/\/[^:]+:[^@]+@/gi,
    /(?:Server|Host|Data Source)\s*=.*(?:User ID|Username|Uid)\s*=.*(?:Password|Pwd)\s*=/gi
  ];

  lines.forEach((line, index) => {
    dbConnectionPatterns.forEach(pattern => {
      if (safeTest(pattern, line) && !line.includes('process.env') && !line.includes('example')) {
        const issue = createIssue(
          'hardcoded-db-connection',
          SEVERITY.CRITICAL,
          'Hardcoded Database Connection String',
          'Your database connection string contains credentials in plain text. If exposed, attackers gain full access to your database - they can read, modify, or delete all your data.',
          'Store the entire connection string in an environment variable: process.env.DATABASE_URL. Never include credentials directly in code.',
          index + 1,
          'Secrets'
        );
        issues.push(issue);
      }
    });
  });

  // Rule 4: JWT Secrets
  const jwtSecretPatterns = [
    /jwt\.sign\([^)]*,\s*["']([^"']{3,})["']/gi,
    /(?:jwt[_-]?secret|jwtSecret)\s*[=:]\s*["']([^"']{3,})["']/gi
  ];

  lines.forEach((line, index) => {
    if (line.includes('process.env') || line.includes('os.getenv')) {
      return;
    }

    jwtSecretPatterns.forEach(pattern => {
      if (safeTest(pattern, line)) {
        const issue = createIssue(
          'hardcoded-jwt-secret',
          SEVERITY.CRITICAL,
          'Hardcoded JWT Secret',
          'Your JWT signing secret is hardcoded. Attackers who find this can forge authentication tokens and impersonate any user in your system, including administrators.',
          'Use a strong random secret stored in environment variables: process.env.JWT_SECRET. Generate with: require("crypto").randomBytes(64).toString("hex")',
          index + 1,
          'Secrets'
        );
        issues.push(issue);
      }
    });
  });

  // Rule 5: OAuth Client Secrets
  const oauthPatterns = [
    /(?:client[_-]?secret|clientSecret)\s*[=:]\s*["']([a-zA-Z0-9_-]{20,})["']/gi
  ];

  lines.forEach((line, index) => {
    if (line.includes('process.env') || line.includes('os.getenv')) {
      return;
    }

    oauthPatterns.forEach(pattern => {
      if (safeTest(pattern, line)) {
        const issue = createIssue(
          'hardcoded-oauth-secret',
          SEVERITY.CRITICAL,
          'Hardcoded OAuth Client Secret',
          'Your OAuth client secret is exposed in the code. Attackers can use this to obtain access tokens and compromise user accounts through your OAuth integration.',
          'Store OAuth secrets in environment variables: process.env.OAUTH_CLIENT_SECRET. These should never be in version control.',
          index + 1,
          'Secrets'
        );
        issues.push(issue);
      }
    });
  });

  // Rule 6: Private Keys
  lines.forEach((line, index) => {
    if (line.includes('-----BEGIN PRIVATE KEY-----') ||
        line.includes('-----BEGIN RSA PRIVATE KEY-----') ||
        line.includes('-----BEGIN EC PRIVATE KEY-----')) {
      const issue = createIssue(
        'hardcoded-private-key',
        SEVERITY.CRITICAL,
        'Private Key in Source Code',
        'Your code contains a private cryptographic key. This completely compromises the security of any encryption, signing, or authentication that uses this key.',
        'Load private keys from secure files outside your repository, use environment variables for key paths, and never commit .pem or .key files to version control.',
        index + 1,
        'Secrets'
      );
      issues.push(issue);
    }
  });

  // Rule 7: Cloud Provider Credentials
  const cloudPatterns = [
    { pattern: /AKIA[0-9A-Z]{16}/g, name: 'AWS Access Key', id: 'aws-key' },
    { pattern: /(?:aws_secret_access_key|AWS_SECRET_ACCESS_KEY)\s*[=:]\s*["']([^"']+)["']/gi, name: 'AWS Secret Key', id: 'aws-secret' },
    { pattern: /DefaultEndpointsProtocol=https;AccountName=[^;]+;AccountKey=[^;]+/gi, name: 'Azure Connection String', id: 'azure-key' }
  ];

  lines.forEach((line, index) => {
    cloudPatterns.forEach(({ pattern, name, id }) => {
      if (safeTest(pattern, line)) {
        const issue = createIssue(
          id,
          SEVERITY.CRITICAL,
          `${name} Detected`,
          `Your code contains ${name}. If exposed, attackers can access your entire cloud infrastructure, potentially costing thousands of dollars and exposing all your data.`,
          `Use IAM roles (AWS), Managed Identities (Azure), or Service Accounts (GCP) instead of hardcoded credentials. For local development, use credential files outside the repository.`,
          index + 1,
          'Secrets'
        );
        issues.push(issue);
      }
    });
  });

  // Add all secret issues
  issues.forEach(issue => {
    results.critical.push(issue);
    results.allIssues.push(issue);
  });

  results.stats.rulesChecked += 10; // Rules 1-10
}

/**
 * Category 2: OWASP Top 10 Vulnerabilities (Rules 16-25)
 */
function detectOWASP(code, lines, results, language) {
  const issues = [];

  // Rule 16: SQL Injection
  const sqlInjectionPatterns = [
    /(?:execute|query|exec)\s*\(\s*["'`](?:SELECT|INSERT|UPDATE|DELETE|DROP).*\+/gi,
    /(?:execute|query|exec)\s*\(\s*["'`].*\$\{[^}]+\}/gi,
    /(?:execute|query|exec)\s*\(\s*["'`].*\+\s*(?!\s*["'`])/gi,
    /(?:execute|query|exec)\s*\(\s*f["'`].*\{[^}]+\}/gi // Python f-strings
  ];

  lines.forEach((line, index) => {
    sqlInjectionPatterns.forEach(pattern => {
      if (safeTest(pattern, line)) {
        // Skip if using parameterized queries (has ? or $1, $2 placeholders)
        if (line.includes('?') || /\$\d+/.test(line)) {
          return;
        }

        const issue = createIssue(
          'sql-injection',
          SEVERITY.CRITICAL,
          'SQL Injection Vulnerability',
          'Your code builds SQL queries by concatenating strings with user input. An attacker can inject malicious SQL commands to read, modify, or delete your entire database. Example: Target breach (2013) - 40 million credit cards stolen.',
          'Use parameterized queries or prepared statements. Example: db.query("SELECT * FROM users WHERE id = ?", [userId]) instead of concatenating strings.',
          index + 1,
          'OWASP'
        );
        issues.push(issue);
      }
    });
  });

  // Rule 17: NoSQL Injection
  if (language === 'javascript' || language === 'typescript') {
    const noSqlPatterns = [
      /\.find\s*\(\s*req\.(?:body|query|params)/gi,
      /\.findOne\s*\(\s*req\.(?:body|query|params)/gi,
      /\.update\s*\(\s*req\.(?:body|query|params)/gi,
      /\.remove\s*\(\s*req\.(?:body|query|params)/gi
    ];

    lines.forEach((line, index) => {
      noSqlPatterns.forEach(pattern => {
        if (safeTest(pattern, line)) {
          const issue = createIssue(
            'nosql-injection',
            SEVERITY.CRITICAL,
            'NoSQL Injection Vulnerability',
            'Your MongoDB query directly uses user input without validation. Attackers can inject query operators like $where, $ne to bypass authentication or access unauthorized data.',
            'Validate and sanitize all user input. Use schema validation (Mongoose) or explicitly whitelist allowed fields. Never pass req.body directly to database queries.',
            index + 1,
            'OWASP'
          );
          issues.push(issue);
        }
      });
    });
  }

  // Rule 18: Cross-Site Scripting (XSS)
  const xssPatterns = [
    /\.innerHTML\s*=(?!\s*["'`])/gi,
    /dangerouslySetInnerHTML\s*=\s*\{\{/gi,
    /document\.write\s*\(/gi,
    /eval\s*\(/gi,
    /new\s+Function\s*\(/gi,
    /setTimeout\s*\(\s*["'`].*\$\{/gi
  ];

  lines.forEach((line, index) => {
    xssPatterns.forEach(pattern => {
      if (safeTest(pattern, line)) {
        const issue = createIssue(
          'xss-vulnerability',
          SEVERITY.CRITICAL,
          'Cross-Site Scripting (XSS) Risk',
          'Your code inserts user content into the DOM without sanitization. Attackers can inject malicious JavaScript to steal session cookies, capture keystrokes, or perform actions as the victim user.',
          'Use textContent instead of innerHTML, or sanitize HTML with DOMPurify. For React, avoid dangerouslySetInnerHTML unless content is sanitized. Never use eval() with user input.',
          index + 1,
          'OWASP'
        );
        issues.push(issue);
      }
    });
  });

  // Rule 19: Command Injection
  const commandInjectionPatterns = [
    /child_process\.exec\s*\([^)]*\+/gi,
    /child_process\.exec\s*\(`.*\$\{/gi,
    /subprocess\.(?:call|run|Popen)\s*\([^)]*\+/gi,
    /os\.system\s*\([^)]*\+/gi,
    /Runtime\.getRuntime\(\)\.exec\s*\([^)]*\+/gi
  ];

  lines.forEach((line, index) => {
    commandInjectionPatterns.forEach(pattern => {
      if (safeTest(pattern, line)) {
        const issue = createIssue(
          'command-injection',
          SEVERITY.CRITICAL,
          'Command Injection Vulnerability',
          'Your code executes system commands with user input. Attackers can inject arbitrary commands (using ; && | operators) to take complete control of your server, steal data, or install malware.',
          'Avoid exec() with user input. Use spawn() or execFile() with argument arrays instead. Example: execFile("ls", [userInput]) is safer than exec("ls " + userInput). Always validate input.',
          index + 1,
          'OWASP'
        );
        issues.push(issue);
      }
    });
  });

  // Rule 20: Path Traversal
  const pathTraversalPatterns = [
    /fs\.readFile\s*\([^)]*\+/gi,
    /fs\.readFileSync\s*\([^)]*\+/gi,
    /res\.sendFile\s*\([^)]*req\./gi,
    /open\s*\([^)]*\+/gi
  ];

  lines.forEach((line, index) => {
    pathTraversalPatterns.forEach(pattern => {
      if (safeTest(pattern, line) && !line.includes('path.resolve') && !line.includes('path.join')) {
        const issue = createIssue(
          'path-traversal',
          SEVERITY.CRITICAL,
          'Path Traversal Vulnerability',
          'Your file operations use unsanitized user input. Attackers can use "../../../" sequences to access sensitive files like /etc/passwd, SSH keys, or application source code containing secrets.',
          'Use path.resolve() and path.join() to normalize paths. Validate that the final path is within allowed directories. Example: const safePath = path.resolve(baseDir, filename); if (!safePath.startsWith(baseDir)) throw error;',
          index + 1,
          'OWASP'
        );
        issues.push(issue);
      }
    });
  });

  // Rule 21: Insecure Deserialization
  const deserializationPatterns = [
    /eval\s*\(/gi,
    /new\s+Function\s*\(/gi,
    /JSON\.parse\s*\(\s*req\./gi,
    /pickle\.loads?\s*\(/gi,
    /yaml\.load\s*\(/gi
  ];

  lines.forEach((line, index) => {
    deserializationPatterns.forEach(pattern => {
      if (safeTest(pattern, line)) {
        // Skip safe patterns
        if (line.includes('yaml.safe_load')) {
          return;
        }

        const issue = createIssue(
          'insecure-deserialization',
          SEVERITY.HIGH,
          'Insecure Deserialization',
          'Your code deserializes or executes untrusted data. Attackers can craft malicious payloads that execute arbitrary code when deserialized, leading to complete server compromise.',
          'Never use eval(), Function(), or pickle.loads() on untrusted input. For YAML, use yaml.safe_load(). For JSON, validate the structure after parsing. Avoid deserializing user-controlled data.',
          index + 1,
          'OWASP'
        );
        issues.push(issue);
      }
    });
  });

  // Rule 22: Server-Side Request Forgery (SSRF)
  const ssrfPatterns = [
    /(?:fetch|axios\.(?:get|post)|request)\s*\(\s*req\.(?:body|query)\./gi,
    /http\.get\s*\(\s*req\./gi
  ];

  lines.forEach((line, index) => {
    ssrfPatterns.forEach(pattern => {
      if (safeTest(pattern, line)) {
        const issue = createIssue(
          'ssrf-vulnerability',
          SEVERITY.HIGH,
          'Server-Side Request Forgery (SSRF)',
          'Your application makes HTTP requests to user-controlled URLs. Attackers can make your server access internal services (AWS metadata, databases) or scan your internal network.',
          'Whitelist allowed domains/IPs. Validate URLs before fetching. Block access to private IP ranges (127.0.0.1, 10.x.x.x, 192.168.x.x). Use a URL parser to validate the protocol and hostname.',
          index + 1,
          'OWASP'
        );
        issues.push(issue);
      }
    });
  });

  // Rule 23: Open Redirect
  const redirectPatterns = [
    /(?:res\.)?redirect\s*\(\s*req\.(?:query|body|params)\./gi,
    /window\.location\s*=\s*(?!["'`])/gi,
    /location\.href\s*=\s*(?!["'`])/gi
  ];

  lines.forEach((line, index) => {
    redirectPatterns.forEach(pattern => {
      if (safeTest(pattern, line)) {
        const issue = createIssue(
          'open-redirect',
          SEVERITY.MEDIUM,
          'Open Redirect Vulnerability',
          'Your application redirects users to URLs from user input. Attackers use this for phishing - they can make legitimate-looking links (yoursite.com/redirect?url=evil.com) to trick users into visiting malicious sites.',
          'Whitelist allowed redirect destinations. Validate that redirect URLs are relative or match allowed domains. Example: if (url.startsWith("/")) res.redirect(url); else throw error;',
          index + 1,
          'OWASP'
        );
        issues.push(issue);
      }
    });
  });

  // Rule 24: Insecure Direct Object References
  const idorPatterns = [
    /\.findById\s*\(\s*req\.params\./gi,
    /\.findOne\s*\(\s*{\s*_?id\s*:\s*req\.params\./gi
  ];

  lines.forEach((line, index) => {
    // Check if there's no authorization check nearby
    const context = lines.slice(Math.max(0, index - 2), Math.min(lines.length, index + 3)).join('\n');

    idorPatterns.forEach(pattern => {
      if (safeTest(pattern, line) && !context.includes('user') && !context.includes('auth') && !context.includes('owner')) {
        const issue = createIssue(
          'idor-vulnerability',
          SEVERITY.HIGH,
          'Insecure Direct Object Reference (IDOR)',
          'Your code accesses database records using user-provided IDs without checking ownership. Users can change the ID in the URL to access other users\' data (e.g., /api/documents/123 → /api/documents/124).',
          'Verify ownership before accessing records. Example: const doc = await Document.findOne({ _id: req.params.id, userId: req.user.id }); or check: if (doc.userId !== req.user.id) throw Forbidden;',
          index + 1,
          'OWASP'
        );
        issues.push(issue);
      }
    });
  });

  // Add all OWASP issues
  issues.forEach(issue => {
    if (issue.severity === SEVERITY.CRITICAL) {
      results.critical.push(issue);
    } else if (issue.severity === SEVERITY.HIGH) {
      results.high.push(issue);
    } else if (issue.severity === SEVERITY.MEDIUM) {
      results.medium.push(issue);
    }
    results.allIssues.push(issue);
  });

  results.stats.rulesChecked += 10; // Rules 16-25
}

/**
 * Category 3: Authentication & Authorization (Rules 26-32)
 */
function detectAuthIssues(code, lines, results, language) {
  const issues = [];

  // Rule 26: Missing Authentication
  if (language === 'javascript' || language === 'typescript') {
    const routePatterns = [
      /app\.(get|post|put|delete|patch)\s*\(\s*["'`]\/api\/admin/gi,
      /router\.(get|post|put|delete|patch)\s*\(\s*["'`]\/admin/gi
    ];

    lines.forEach((line, index) => {
      routePatterns.forEach(pattern => {
        if (safeTest(pattern, line)) {
          // Check if auth middleware is present in the same line or next few lines
          const context = lines.slice(index, Math.min(lines.length, index + 2)).join('\n');
          if (!context.includes('auth') && !context.includes('verify') && !context.includes('protect')) {
            const issue = createIssue(
              'missing-authentication',
              SEVERITY.CRITICAL,
              'Missing Authentication Middleware',
              'Your admin/API routes are not protected by authentication middleware. Anyone can access these endpoints without logging in, potentially allowing unauthorized users to perform privileged actions.',
              'Add authentication middleware to protected routes. Example: app.post("/api/admin/delete", authenticateToken, deleteUser). Use passport.js, JWT verification, or session middleware.',
              index + 1,
              'Authentication'
            );
            issues.push(issue);
          }
        }
      });
    });
  }

  // Rule 27: Weak Password Requirements
  const weakPasswordPatterns = [
    /password\.length\s*[<>=!]+\s*[1-7](?!\d)/gi,
    /if\s*\(\s*password\s*\)/gi  // Only checks if password exists, no validation
  ];

  lines.forEach((line, index) => {
    weakPasswordPatterns.forEach(pattern => {
      if (safeTest(pattern, line)) {
        const issue = createIssue(
          'weak-password-policy',
          SEVERITY.HIGH,
          'Weak Password Requirements',
          'Your password validation accepts short or simple passwords. Weak passwords are easily cracked through brute force attacks, especially if your database is breached.',
          'Enforce strong passwords: minimum 12 characters, require mix of uppercase, lowercase, numbers, and special characters. Use a library like validator.js or implement: password.length >= 12 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9]/.test(password)',
          index + 1,
          'Authentication'
        );
        issues.push(issue);
      }
    });
  });

  // Rule 28: Missing Rate Limiting
  if (language === 'javascript' || language === 'typescript') {
    const loginPatterns = [
      /app\.post\s*\(\s*["'`].*login["'`]/gi,
      /router\.post\s*\(\s*["'`].*login["'`]/gi,
      /app\.post\s*\(\s*["'`].*auth["'`]/gi
    ];

    lines.forEach((line, index) => {
      loginPatterns.forEach(pattern => {
        if (safeTest(pattern, line)) {
          const context = lines.slice(Math.max(0, index - 5), Math.min(lines.length, index + 2)).join('\n');
          if (!context.includes('rateLimit') && !context.includes('limiter')) {
            const issue = createIssue(
              'missing-rate-limiting',
              SEVERITY.HIGH,
              'Missing Rate Limiting on Authentication',
              'Your login endpoint has no rate limiting. Attackers can make unlimited login attempts to brute force passwords or cause denial of service.',
              'Add rate limiting middleware: const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5 }); app.post("/login", limiter, loginHandler); This limits to 5 attempts per 15 minutes per IP.',
              index + 1,
              'Authentication'
            );
            issues.push(issue);
          }
        }
      });
    });
  }

  // Rule 29: Session Fixation
  const sessionPatterns = [
    /req\.session\.user\s*=/gi,
    /session\.userId\s*=/gi
  ];

  lines.forEach((line, index) => {
    sessionPatterns.forEach(pattern => {
      if (safeTest(pattern, line)) {
        const context = lines.slice(Math.max(0, index - 3), Math.min(lines.length, index + 3)).join('\n');
        if (!context.includes('regenerate') && !context.includes('destroy')) {
          const issue = createIssue(
            'session-fixation',
            SEVERITY.HIGH,
            'Potential Session Fixation',
            'Your code creates sessions without regenerating the session ID after login. Attackers can fixate a session ID before authentication and hijack the session after the victim logs in.',
            'Regenerate session ID after successful login: req.session.regenerate((err) => { req.session.user = user; }); This prevents session fixation attacks.',
            index + 1,
            'Authentication'
          );
          issues.push(issue);
        }
      }
    });
  });

  // Rule 30: Insecure Session Storage (JWT in localStorage)
  if (language === 'javascript' || language === 'typescript') {
    const localStoragePatterns = [
      /localStorage\.setItem\s*\(\s*["'`]token["'`]/gi,
      /localStorage\.setItem\s*\(\s*["'`]jwt["'`]/gi,
      /sessionStorage\.setItem\s*\(\s*["'`]token["'`]/gi
    ];

    lines.forEach((line, index) => {
      localStoragePatterns.forEach(pattern => {
        if (safeTest(pattern, line)) {
          const issue = createIssue(
            'insecure-token-storage',
            SEVERITY.HIGH,
            'Insecure Token Storage',
            'Your application stores authentication tokens in localStorage or sessionStorage. These are accessible to JavaScript, making them vulnerable to XSS attacks - if any script can run on your page, it can steal all user sessions.',
            'Store tokens in httpOnly cookies (not accessible to JavaScript). Server-side: res.cookie("token", jwt, { httpOnly: true, secure: true, sameSite: "strict" }). Never store sensitive tokens in localStorage.',
            index + 1,
            'Authentication'
          );
          issues.push(issue);
        }
      });
    });
  }

  // Rule 31: Missing CSRF Protection
  if (language === 'javascript' || language === 'typescript') {
    const stateChangingPatterns = [
      /app\.post\s*\(/gi,
      /app\.put\s*\(/gi,
      /app\.delete\s*\(/gi,
      /router\.post\s*\(/gi,
      /router\.put\s*\(/gi,
      /router\.delete\s*\(/gi
    ];

    lines.forEach((line, index) => {
      stateChangingPatterns.forEach(pattern => {
        if (safeTest(pattern, line)) {
          const context = lines.slice(Math.max(0, index - 10), Math.min(lines.length, index + 2)).join('\n');
          if (!context.includes('csrf') && !context.includes('SameSite') && !context.match(/app\.use\(.*csrf/)) {
            const issue = createIssue(
              'missing-csrf-protection',
              SEVERITY.HIGH,
              'Missing CSRF Protection',
              'Your state-changing endpoints lack CSRF protection. Attackers can trick logged-in users into making unwanted requests (delete account, transfer money, change email) just by visiting a malicious website.',
              'Add CSRF protection: Use csurf middleware or set SameSite cookie attribute. Example: app.use(csrf()); or set cookies with sameSite: "strict". Include CSRF tokens in forms.',
              index + 1,
              'Authentication'
            );
            issues.push(issue);
          }
        }
      });
    });
  }

  // Rule 32: Privilege Escalation
  const privilegePatterns = [
    /user\.role\s*=\s*req\.(?:body|params|query)\./gi,
    /user\.isAdmin\s*=\s*req\.(?:body|params|query)\./gi,
    /admin\s*:\s*req\.body\.admin/gi
  ];

  lines.forEach((line, index) => {
    privilegePatterns.forEach(pattern => {
      if (safeTest(pattern, line)) {
        const issue = createIssue(
          'privilege-escalation',
          SEVERITY.CRITICAL,
          'Privilege Escalation Vulnerability',
          'Your code allows users to set their own role/admin status from request data. Users can make themselves administrators by manipulating the request, gaining full access to your system.',
          'Never let users set their own privileges. Only allow admins to change user roles. Example: if (req.user.isAdmin) { user.role = newRole; } else { throw Forbidden; }. Always validate on the server side.',
          index + 1,
          'Authentication'
        );
        issues.push(issue);
      }
    });
  });

  // Add all auth issues
  issues.forEach(issue => {
    if (issue.severity === SEVERITY.CRITICAL) {
      results.critical.push(issue);
    } else if (issue.severity === SEVERITY.HIGH) {
      results.high.push(issue);
    }
    results.allIssues.push(issue);
  });

  results.stats.rulesChecked += 7; // Rules 26-32
}

/**
 * Category 4: Data Protection & Privacy (Rules 34-38)
 */
function detectDataProtection(code, lines, results, language) {
  const issues = [];

  // Rule 34: Passwords Without Hashing
  const plaintextPasswordPatterns = [
    /user\.password\s*=\s*req\.body\.password/gi,
    /password\s*:\s*req\.body\.password/gi,
    /INSERT.*VALUES.*password/gi
  ];

  lines.forEach((line, index) => {
    // Skip if bcrypt, argon2, or hash is mentioned
    const context = lines.slice(Math.max(0, index - 2), Math.min(lines.length, index + 3)).join('\n');
    if (context.includes('bcrypt') || context.includes('argon2') || context.includes('hash')) {
      return;
    }

    plaintextPasswordPatterns.forEach(pattern => {
      if (safeTest(pattern, line)) {
        const issue = createIssue(
          'plaintext-password',
          SEVERITY.CRITICAL,
          'Passwords Stored Without Hashing',
          'Your code stores passwords in plain text. When your database is breached (and breaches happen), attackers instantly have all user passwords. Users who reuse passwords across sites are then compromised everywhere.',
          'Hash passwords before storing: const hashedPassword = await bcrypt.hash(password, 10); user.password = hashedPassword; Never store plain text passwords. Use bcrypt, argon2, or scrypt.',
          index + 1,
          'Data Protection'
        );
        issues.push(issue);
      }
    });
  });

  // Rule 35: Weak Hashing Algorithms
  const weakHashPatterns = [
    /crypto\.createHash\s*\(\s*["'`](md5|sha1)["'`]\s*\)/gi,
    /hashlib\.(md5|sha1)\s*\(/gi,
    /MessageDigest\.getInstance\s*\(\s*["'`](MD5|SHA-1)["'`]\s*\)/gi
  ];

  lines.forEach((line, index) => {
    weakHashPatterns.forEach(pattern => {
      if (safeTest(pattern, line) && (line.toLowerCase().includes('password') || line.toLowerCase().includes('pass'))) {
        const issue = createIssue(
          'weak-hashing',
          SEVERITY.HIGH,
          'Weak Password Hashing Algorithm',
          'Your code uses MD5 or SHA-1 for password hashing. These algorithms are fast, which is bad for passwords - attackers can try billions of passwords per second using rainbow tables and GPU acceleration.',
          'Use slow hashing algorithms designed for passwords: bcrypt, argon2, or scrypt. Example: bcrypt.hash(password, 10) with 10+ rounds. Never use MD5/SHA-1 for passwords.',
          index + 1,
          'Data Protection'
        );
        issues.push(issue);
      }
    });
  });

  // Rule 36: Missing HTTPS Enforcement
  const httpPatterns = [
    /http:\/\/(?!localhost|127\.0\.0\.1)/gi,
    /secure\s*:\s*false/gi
  ];

  lines.forEach((line, index) => {
    httpPatterns.forEach(pattern => {
      if (safeTest(pattern, line) && !line.includes('example')) {
        const issue = createIssue(
          'missing-https',
          SEVERITY.CRITICAL,
          'HTTP Connection Without Encryption',
          'Your application uses unencrypted HTTP connections. All data (including passwords, session tokens, personal information) is sent in plain text over the network where attackers can intercept it.',
          'Always use HTTPS in production. Set up SSL certificates (free with Let\'s Encrypt). Force HTTPS with: app.use((req, res, next) => { if (!req.secure) return res.redirect("https://" + req.headers.host + req.url); next(); })',
          index + 1,
          'Data Protection'
        );
        issues.push(issue);
      }
    });
  });

  // Rule 37: Insecure CORS Configuration
  const corsPatterns = [
    /Access-Control-Allow-Origin["'`]?\s*:\s*["'`]\*["'`]/gi,
    /cors\s*\(\s*{\s*origin\s*:\s*true/gi,
    /cors\s*\(\s*\)/gi
  ];

  lines.forEach((line, index) => {
    corsPatterns.forEach(pattern => {
      if (safeTest(pattern, line)) {
        const context = lines.slice(Math.max(0, index - 2), Math.min(lines.length, index + 2)).join('\n');
        if (context.includes('credentials') || context.includes('cookie')) {
          const issue = createIssue(
            'insecure-cors',
            SEVERITY.HIGH,
            'Insecure CORS Configuration',
            'Your CORS policy allows all origins (*) while using credentials. This allows any website to make authenticated requests to your API, potentially stealing user data or performing unauthorized actions.',
            'Whitelist specific origins: cors({ origin: ["https://yoursite.com", "https://app.yoursite.com"], credentials: true }). Never use origin: "*" with credentials: true.',
            index + 1,
            'Data Protection'
          );
          issues.push(issue);
        }
      }
    });
  });

  // Rule 38: Missing Security Headers
  if (language === 'javascript' || language === 'typescript') {
    const hasHelmet = code.includes('helmet') || code.includes('helmet()');
    const hasSecurityHeaders = code.includes('X-Frame-Options') ||
                              code.includes('X-Content-Type-Options') ||
                              code.includes('Content-Security-Policy');

    if (!hasHelmet && !hasSecurityHeaders) {
      const issue = createIssue(
        'missing-security-headers',
        SEVERITY.MEDIUM,
        'Missing Security Headers',
        'Your application doesn\'t set security headers (X-Frame-Options, CSP, X-Content-Type-Options). This leaves users vulnerable to clickjacking, MIME sniffing attacks, and other client-side exploits.',
        'Add helmet.js middleware: app.use(helmet()); This automatically sets secure headers. Or manually set: res.setHeader("X-Frame-Options", "DENY"); res.setHeader("X-Content-Type-Options", "nosniff");',
        null,
        'Data Protection'
      );
      results.medium.push(issue);
      results.allIssues.push(issue);
    }
  }

  // Add all data protection issues
  issues.forEach(issue => {
    if (issue.severity === SEVERITY.CRITICAL) {
      results.critical.push(issue);
    } else if (issue.severity === SEVERITY.HIGH) {
      results.high.push(issue);
    } else if (issue.severity === SEVERITY.MEDIUM) {
      results.medium.push(issue);
    }
    results.allIssues.push(issue);
  });

  results.stats.rulesChecked += 5; // Rules 34-38 (Rule 33 is PII in logs, skipped for now)
}

/**
 * Category 5: Environment Variable Usage (Rules 11-15)
 */
function detectEnvironmentVariables(code, lines, results, language) {
  const issues = [];

  // Rule 11: Missing .env.example
  // This is a file-level check, we can only detect if code references env vars without documentation
  const hasEnvVars = /process\.env\.|os\.getenv\(|System\.getenv\(/gi.test(code);
  const hasEnvExample = code.includes('.env.example') || code.includes('ENV_EXAMPLE');

  if (hasEnvVars && !hasEnvExample) {
    // Note: This is a soft check - we can't actually verify the file exists
    const issue = createIssue(
      'missing-env-example',
      SEVERITY.MEDIUM,
      'Missing .env.example Documentation',
      'Your code uses environment variables but doesn\'t appear to document them. Without a .env.example file, other developers won\'t know which environment variables are required to run your application.',
      'Create a .env.example file in your repository root with placeholder values for all required environment variables. Example: API_KEY=your_api_key_here, DATABASE_URL=your_database_url_here. Never commit the actual .env file.',
      null,
      'Environment Variables'
    );
    results.medium.push(issue);
    results.allIssues.push(issue);
  }

  // Rule 12: .env in Git
  lines.forEach((line, index) => {
    // Check for .env file being tracked or committed
    if (line.includes('.env') && (
        line.includes('git add') ||
        line.includes('git commit') ||
        (line.includes('.gitignore') && line.includes('!') && line.includes('.env'))
      )) {
      const issue = createIssue(
        'env-in-git',
        SEVERITY.CRITICAL,
        '.env File Tracked in Git',
        'Your .env file appears to be tracked by git. This means all your secrets (API keys, passwords, database URLs) will be stored in git history forever, even if you delete the file later. Anyone with access to your repository can see all your secrets.',
        'Add .env to .gitignore immediately: echo ".env" >> .gitignore. Then remove from git history: git rm --cached .env && git commit -m "Remove .env from git". If already pushed, consider all secrets compromised and rotate them.',
        index + 1,
        'Environment Variables'
      );
      issues.push(issue);
    }

    // Check for .gitignore NOT ignoring .env
    if (line.trim() === '.gitignore' || line.includes('gitignore:')) {
      const gitignoreContext = lines.slice(Math.max(0, index - 5), Math.min(lines.length, index + 20)).join('\n');
      if (!gitignoreContext.includes('.env') || gitignoreContext.includes('!.env')) {
        const issue = createIssue(
          'env-not-in-gitignore',
          SEVERITY.CRITICAL,
          '.env Not in .gitignore',
          'Your .gitignore file doesn\'t properly exclude .env files. This means .env files could be accidentally committed to version control, exposing all your secrets to anyone with repository access.',
          'Add these lines to your .gitignore file:\n.env\n.env.local\n.env.*.local\n\nThis prevents environment files from being committed.',
          index + 1,
          'Environment Variables'
        );
        issues.push(issue);
      }
    }
  });

  // Rule 13: Direct process.env Access Without Fallback
  const unsafeEnvPatterns = [
    /process\.env\.(?!NODE_ENV)[A-Z_]+(?!\s*\|\|)/g,
    /os\.getenv\(['"](?!PATH)[^'"]+['"]\)(?!\s*or\s)/g
  ];

  lines.forEach((line, index) => {
    unsafeEnvPatterns.forEach(pattern => {
      if (safeTest(pattern, line) && !line.includes('||') && !line.includes('??') && !line.includes('if')) {
        const issue = createIssue(
          'unsafe-env-access',
          SEVERITY.MEDIUM,
          'Environment Variable Used Without Fallback',
          'Your code accesses environment variables without checking if they exist or providing defaults. If the variable is missing, your application will crash or behave unpredictably in production.',
          'Always validate environment variables at startup or provide defaults: const apiKey = process.env.API_KEY || throwError("API_KEY missing"); or use a validation library like joi or envalid to validate all required env vars on startup.',
          index + 1,
          'Environment Variables'
        );
        issues.push(issue);
      }
    });
  });

  // Rule 14: Environment Variables in Client-Side Code
  if (language === 'javascript' || language === 'typescript') {
    const clientSideFrameworks = [
      'react', 'vue', 'angular', 'svelte',
      'useState', 'useEffect', 'component',
      'render(', 'return (', '<div', '<App'
    ];

    const hasClientSideCode = clientSideFrameworks.some(framework =>
      code.toLowerCase().includes(framework.toLowerCase())
    );

    if (hasClientSideCode) {
      lines.forEach((line, index) => {
        // Check for secrets in client-side code
        if (line.includes('process.env') && (
            line.toLowerCase().includes('secret') ||
            line.toLowerCase().includes('password') ||
            line.toLowerCase().includes('key') ||
            line.toLowerCase().includes('token')
          )) {
          // Skip public keys and REACT_APP_ prefixes (which are safe for client-side)
          if (!line.includes('REACT_APP_') &&
              !line.includes('NEXT_PUBLIC_') &&
              !line.includes('VITE_') &&
              !line.includes('PUBLIC_')) {
            const issue = createIssue(
              'secrets-in-client-code',
              SEVERITY.HIGH,
              'Secrets in Client-Side Code',
              'Your client-side code (React/Vue/Angular) accesses secret environment variables. Client-side code is bundled and sent to browsers - anyone can read it by viewing your JavaScript files. All secrets will be exposed.',
              'Only use environment variables for PUBLIC values in client-side code (prefixed with REACT_APP_, NEXT_PUBLIC_, or VITE_). Keep secrets on the server: Create API endpoints on your backend that use the secrets, and have your frontend call those APIs.',
              index + 1,
              'Environment Variables'
            );
            issues.push(issue);
          }
        }
      });
    }
  }

  // Rule 15: Insecure Environment Variable Names
  const insecureVarNames = [
    /process\.env\.PASSWORD(?![_A-Z])/g,
    /process\.env\.SECRET(?![_A-Z])/g,
    /process\.env\.KEY(?![_A-Z])/g,
    /process\.env\.TOKEN(?![_A-Z])/g,
    /os\.getenv\(['"]PASSWORD['"]\)/g,
    /os\.getenv\(['"]SECRET['"]\)/g
  ];

  lines.forEach((line, index) => {
    insecureVarNames.forEach(pattern => {
      if (safeTest(pattern, line)) {
        const issue = createIssue(
          'insecure-env-names',
          SEVERITY.LOW,
          'Non-Descriptive Environment Variable Names',
          'Your environment variable names are too generic (PASSWORD, SECRET, KEY). In larger applications with multiple services, this causes confusion - which password? Which secret? Developers might set the wrong values.',
          'Use descriptive, namespaced environment variable names. Examples: DB_PASSWORD, JWT_SECRET, STRIPE_API_KEY, AWS_ACCESS_KEY. This makes configuration clearer and prevents mistakes.',
          index + 1,
          'Environment Variables'
        );
        issues.push(issue);
      }
    });
  });

  // Add all environment variable issues
  issues.forEach(issue => {
    if (issue.severity === SEVERITY.CRITICAL) {
      results.critical.push(issue);
    } else if (issue.severity === SEVERITY.HIGH) {
      results.high.push(issue);
    } else if (issue.severity === SEVERITY.MEDIUM) {
      results.medium.push(issue);
    } else if (issue.severity === SEVERITY.LOW) {
      results.low.push(issue);
    }
    results.allIssues.push(issue);
  });

  results.stats.rulesChecked += 5; // Rules 11-15
}

/**
 * Category 6: Configuration Security (Rules 46-52)
 */
function detectConfigurationIssues(code, lines, results, language) {
  const issues = [];

  // Rule 46: Debug Mode in Production
  const debugPatterns = [
    /DEBUG\s*=\s*[Tt]rue/g,
    /process\.env\.NODE_ENV\s*!==?\s*["']production["']/g,
    /app\.set\(\s*["']env["']\s*,\s*["']development["']\s*\)/g,
    /debug:\s*true/gi,
    /\.setLevel\(\s*["']debug["']\s*\)/gi
  ];

  lines.forEach((line, index) => {
    debugPatterns.forEach(pattern => {
      if (safeTest(pattern, line) && !line.includes('if') && !line.includes('//')) {
        const issue = createIssue(
          'debug-mode-production',
          SEVERITY.HIGH,
          'Debug Mode Enabled',
          'Your application has debug mode enabled. In production, this exposes detailed error messages with stack traces, internal file paths, and database queries to users. Attackers use this information to understand your application structure and find vulnerabilities.',
          'Set NODE_ENV=production in production environments. Use: if (process.env.NODE_ENV !== "production") { app.set("debug", true); } to only enable debug mode in development.',
          index + 1,
          'Configuration'
        );
        issues.push(issue);
      }
    });
  });

  // Rule 47: Default Credentials
  const defaultCredPatterns = [
    /(?:username|user).*[=:]\s*["'](admin|root|administrator)["']/gi,
    /(?:password|passwd).*[=:]\s*["'](admin|password|123456|root)["']/gi,
    /(?:username|user).*[=:]\s*["']admin["'].*(?:password|passwd).*[=:]\s*["']admin["']/gi
  ];

  lines.forEach((line, index) => {
    defaultCredPatterns.forEach(pattern => {
      if (safeTest(pattern, line)) {
        const issue = createIssue(
          'default-credentials',
          SEVERITY.CRITICAL,
          'Default Credentials Detected',
          'Your code uses default credentials like admin/admin or root/password. These are the first things attackers try. Attackers have automated tools that scan the internet trying common default credentials on every server they find.',
          'Change ALL default credentials before deployment. Use strong, unique passwords stored in environment variables. For databases and admin panels, require password changes on first login.',
          index + 1,
          'Configuration'
        );
        issues.push(issue);
      }
    });
  });

  // Rule 48: Exposed Admin Panels
  if (language === 'javascript' || language === 'typescript') {
    const adminRoutePatterns = [
      /app\.(get|post|put|delete|all)\s*\(\s*["'`]\/admin/gi,
      /router\.(get|post|put|delete|all)\s*\(\s*["'`]\/admin/gi,
      /path\s*:\s*["'`]\/admin/gi,
      /route\s*:\s*["'`]\/dashboard/gi
    ];

    lines.forEach((line, index) => {
      adminRoutePatterns.forEach(pattern => {
        if (safeTest(pattern, line)) {
          const context = lines.slice(Math.max(0, index - 2), Math.min(lines.length, index + 3)).join('\n');
          if (!context.includes('auth') &&
              !context.includes('protect') &&
              !context.includes('verify') &&
              !context.includes('isAdmin') &&
              !context.includes('requireAdmin')) {
            const issue = createIssue(
              'exposed-admin-panel',
              SEVERITY.HIGH,
              'Admin Panel Without Authentication',
              'Your admin routes (/admin, /dashboard) appear to be accessible without authentication. Anyone who discovers these URLs can access your admin panel and potentially control your entire application.',
              'Protect admin routes with authentication AND authorization middleware: app.use("/admin", requireAuth, requireAdmin, adminRouter); Also consider IP whitelisting for admin panels.',
              index + 1,
              'Configuration'
            );
            issues.push(issue);
          }
        }
      });
    });
  }

  // Rule 49: Directory Listing Enabled
  if (language === 'javascript' || language === 'typescript') {
    const staticServePatterns = [
      /express\.static\s*\(/gi,
      /serve-static/gi,
      /serveStatic/gi
    ];

    lines.forEach((line, index) => {
      staticServePatterns.forEach(pattern => {
        if (safeTest(pattern, line)) {
          const context = lines.slice(index, Math.min(lines.length, index + 3)).join('\n');
          if (!context.includes('index:') && !context.includes('index.html')) {
            const issue = createIssue(
              'directory-listing',
              SEVERITY.MEDIUM,
              'Potential Directory Listing Enabled',
              'Your static file serving may allow directory listing. When users visit a directory without an index.html, they\'ll see a list of all files. This exposes your file structure, configuration files, and potentially sensitive documents.',
              'Ensure directories have index.html files, or configure express.static with index: false and handle directory requests explicitly. Example: app.use(express.static("public", { index: "index.html" }));',
              index + 1,
              'Configuration'
            );
            issues.push(issue);
          }
        }
      });
    });
  }

  // Rule 50: Insecure File Uploads
  const fileUploadPatterns = [
    /multer/gi,
    /express-fileupload/gi,
    /formidable/gi,
    /req\.files?/gi,
    /upload\./gi
  ];

  const hasFileUpload = fileUploadPatterns.some(pattern => safeTest(pattern, code));

  if (hasFileUpload) {
    const hasValidation = /\.mimetype/gi.test(code) ||
                         /fileFilter/gi.test(code) ||
                         /\.size/gi.test(code) ||
                         /limits:/gi.test(code);

    const hasMalwareCheck = /antivirus|clamav|virus|malware|scan/gi.test(code);

    if (!hasValidation || !hasMalwareCheck) {
      const issue = createIssue(
        'insecure-file-upload',
        SEVERITY.CRITICAL,
        'Insecure File Upload Configuration',
        'Your file upload implementation lacks proper validation. Attackers can upload executable files (.php, .jsp, .exe) or extremely large files to crash your server. Uploaded files can execute code and take over your server.',
        'Implement comprehensive file upload security: 1) Validate file types (whitelist allowed extensions), 2) Check file size limits, 3) Rename files (don\'t use original names), 4) Store outside web root, 5) Scan for malware. Example: multer({ fileFilter: (req, file, cb) => { if (allowedTypes.includes(file.mimetype)) cb(null, true); else cb(new Error("Invalid file type")); }, limits: { fileSize: 5 * 1024 * 1024 } })',
        null,
        'Configuration'
      );
      results.critical.push(issue);
      results.allIssues.push(issue);
    }
  }

  // Rule 51: Missing Input Validation
  if (language === 'javascript' || language === 'typescript') {
    const hasUserInput = /req\.(body|query|params)/gi.test(code);
    const hasValidation = /joi|yup|express-validator|validate|schema|ajv/gi.test(code);

    if (hasUserInput && !hasValidation) {
      const issue = createIssue(
        'missing-input-validation',
        SEVERITY.HIGH,
        'Missing Input Validation',
        'Your code uses user input (req.body, req.query, req.params) without validation. Users can send unexpected data types, missing fields, or malicious values that crash your application or bypass security checks.',
        'Use a validation library to validate ALL user input: joi, yup, or express-validator. Example: const schema = Joi.object({ email: Joi.string().email().required(), age: Joi.number().min(0).max(120) }); const { error, value } = schema.validate(req.body);',
        null,
        'Configuration'
      );
      results.high.push(issue);
      results.allIssues.push(issue);
    }
  }

  // Rule 52: Insecure Cookie Settings
  const cookiePatterns = [
    /res\.cookie\s*\(/gi,
    /\.cookie\s*\(/gi,
    /setCookie/gi,
    /session\(/gi
  ];

  lines.forEach((line, index) => {
    cookiePatterns.forEach(pattern => {
      if (safeTest(pattern, line)) {
        const context = lines.slice(index, Math.min(lines.length, index + 5)).join('\n');

        const hasHttpOnly = /httpOnly\s*:\s*true/gi.test(context);
        const hasSecure = /secure\s*:\s*true/gi.test(context);
        const hasSameSite = /sameSite/gi.test(context);

        if (!hasHttpOnly || !hasSecure || !hasSameSite) {
          const missing = [];
          if (!hasHttpOnly) missing.push('httpOnly');
          if (!hasSecure) missing.push('secure');
          if (!hasSameSite) missing.push('sameSite');

          const issue = createIssue(
            'insecure-cookie-settings',
            SEVERITY.HIGH,
            'Insecure Cookie Configuration',
            `Your cookies are missing security flags: ${missing.join(', ')}. Without httpOnly, JavaScript can steal cookies (XSS attacks). Without secure, cookies are sent over HTTP (can be intercepted). Without sameSite, your site is vulnerable to CSRF attacks.`,
            `Always set all three flags: res.cookie("token", value, { httpOnly: true, secure: true, sameSite: "strict" }); httpOnly prevents XSS, secure requires HTTPS, sameSite prevents CSRF.`,
            index + 1,
            'Configuration'
          );
          issues.push(issue);
        }
      }
    });
  });

  // Add all configuration issues
  issues.forEach(issue => {
    if (issue.severity === SEVERITY.CRITICAL) {
      results.critical.push(issue);
    } else if (issue.severity === SEVERITY.HIGH) {
      results.high.push(issue);
    } else if (issue.severity === SEVERITY.MEDIUM) {
      results.medium.push(issue);
    } else if (issue.severity === SEVERITY.LOW) {
      results.low.push(issue);
    }
    results.allIssues.push(issue);
  });

  results.stats.rulesChecked += 7; // Rules 46-52
}

/**
 * Category 7: Dependency & Supply Chain Security (Rules 41-45)
 */
function detectDependencyIssues(code, lines, results, language) {
  const issues = [];

  // Check if this is a package.json file or contains dependency information
  const isPackageJson = code.includes('"dependencies"') || code.includes('"devDependencies"');
  const hasRequire = /require\s*\(\s*['"][^'"]+['"]\s*\)/g.test(code);
  const hasImport = /import\s+.*\s+from\s+['"][^'"]+['"]/g.test(code);

  // Rule 41: Outdated Dependencies
  // Pattern: Look for old version patterns and common outdated packages
  const knownOutdatedPatterns = [
    { pattern: /["']request["']:\s*["']\^?[0-2]\./gi, name: 'request', reason: 'deprecated, use axios or node-fetch' },
    { pattern: /["']moment["']:\s*["']\^?[0-2]\.[0-9]/gi, name: 'moment', reason: 'large bundle, use date-fns or dayjs' },
    { pattern: /["']lodash["']:\s*["']\^?[0-4]\.[0-9]/gi, name: 'lodash', reason: 'old version, update to latest' },
    { pattern: /["']express["']:\s*["']\^?[0-3]\./gi, name: 'express', reason: 'old version with known vulnerabilities' },
    { pattern: /["']axios["']:\s*["']\^?0\.[0-1][0-9]/gi, name: 'axios', reason: 'very old version, update to 1.x' },
    { pattern: /["']react["']:\s*["']\^?1[0-5]\./gi, name: 'react', reason: 'old version, update to React 18+' },
    { pattern: /["']next["']:\s*["']\^?[0-9]\./gi, name: 'next', reason: 'old version, update to Next 13+' }
  ];

  lines.forEach((line, index) => {
    knownOutdatedPatterns.forEach(({ pattern, name, reason }) => {
      if (safeTest(pattern, line)) {
        const issue = createIssue(
          'outdated-dependency',
          SEVERITY.HIGH,
          `Outdated Dependency: ${name}`,
          `Your package.json includes an outdated version of ${name}. Outdated packages may contain known security vulnerabilities (CVEs) that attackers can exploit. Old versions also lack bug fixes and security patches.`,
          `Update ${name} to the latest version: npm update ${name} or npm install ${name}@latest. Check for breaking changes in the release notes. Run npm audit to check for vulnerabilities. Reason: ${reason}`,
          index + 1,
          'Dependencies'
        );
        issues.push(issue);
      }
    });
  });

  // Check for general old version patterns in package.json
  if (isPackageJson) {
    // Detect very old major versions (0.x, 1.x for commonly updated packages)
    const oldVersionPattern = /["'][^"']+["']:\s*["']\^?0\.[0-9]+\.[0-9]+["']/gi;
    lines.forEach((line, index) => {
      if (safeTest(oldVersionPattern, line) && !line.includes('//')) {
        const packageMatch = line.match(/["']([^"']+)["']:\s*["']\^?0\./);
        if (packageMatch) {
          const packageName = packageMatch[1];
          // Skip packages that commonly use 0.x versioning
          if (!['prettier', 'eslint', 'webpack'].includes(packageName)) {
            const issue = createIssue(
              'very-old-dependency',
              SEVERITY.HIGH,
              'Very Old Dependency Version',
              `Package "${packageName}" is on a pre-1.0 version (0.x). These versions may be unstable, unmaintained, or have known security vulnerabilities. Pre-release versions often have breaking changes and lack long-term support.`,
              `Check if a stable 1.x+ version exists: npm info ${packageName}. If available, update with: npm install ${packageName}@latest. Review changelog for breaking changes. Consider alternatives if the package is abandoned.`,
              index + 1,
              'Dependencies'
            );
            issues.push(issue);
          }
        }
      }
    });
  }

  // Rule 42: Dependencies with Malware
  // Known malicious package patterns and typosquatting
  const suspiciousPatterns = [
    { pattern: /["']event-stream["']:\s*["']3\.3\.6["']/gi, name: 'event-stream@3.3.6', reason: 'contained bitcoin-stealing malware' },
    { pattern: /["']eslint-scope["']:\s*["']3\.7\.2["']/gi, name: 'eslint-scope@3.7.2', reason: 'contained credential harvester' },
    { pattern: /["']crossenv["']/gi, name: 'crossenv', reason: 'typosquatting attack (correct: cross-env)' },
    { pattern: /["']babelcli["']/gi, name: 'babelcli', reason: 'typosquatting attack (correct: babel-cli)' },
    { pattern: /["']cros-env["']/gi, name: 'cros-env', reason: 'typosquatting attack (correct: cross-env)' },
  ];

  lines.forEach((line, index) => {
    suspiciousPatterns.forEach(({ pattern, name, reason }) => {
      if (safeTest(pattern, line)) {
        const issue = createIssue(
          'malicious-dependency',
          SEVERITY.CRITICAL,
          `Potentially Malicious Package: ${name}`,
          `Your dependencies include "${name}" which is a known malicious package or typosquatting attack. Malicious packages can steal credentials, inject backdoors, mine cryptocurrency, or exfiltrate sensitive data from your server.`,
          `Remove this package immediately: npm uninstall ${name.split('@')[0]}. Install the correct package if this was a typo. Scan your codebase for any unauthorized changes. Rotate all credentials. Reason: ${reason}`,
          index + 1,
          'Dependencies'
        );
        issues.push(issue);
      }
    });
  });

  // Check for common typosquatting patterns
  const commonTypos = [
    { wrong: 'reacct', correct: 'react' },
    { wrong: 'loadsh', correct: 'lodash' },
    { wrong: 'expres', correct: 'express' },
    { wrong: 'mongo-db', correct: 'mongodb' },
    { wrong: 'socket-io', correct: 'socket.io' }
  ];

  lines.forEach((line, index) => {
    commonTypos.forEach(({ wrong, correct }) => {
      const typoPattern = new RegExp(`["']${wrong}["']`, 'gi');
      if (typoPattern.test(line)) {
        const issue = createIssue(
          'typosquatting-risk',
          SEVERITY.HIGH,
          `Possible Typosquatting: "${wrong}"`,
          `Your dependencies include "${wrong}" which may be a typosquatting attack targeting "${correct}". Attackers register packages with names similar to popular packages to trick developers. These malicious packages can steal data or inject malware.`,
          `Verify this is intentional. If it's a typo, uninstall and install the correct package: npm uninstall ${wrong} && npm install ${correct}. Always double-check package names before installing.`,
          index + 1,
          'Dependencies'
        );
        issues.push(issue);
      }
    });
  });

  // Rule 43: Unused Dependencies
  if (isPackageJson) {
    // Extract declared dependencies
    const dependencyMatches = code.match(/["']([a-z0-9-_@/]+)["']:\s*["'][^"']+["']/gi);
    if (dependencyMatches) {
      const declaredPackages = dependencyMatches
        .map(match => {
          const nameMatch = match.match(/["']([a-z0-9-_@/]+)["']:/i);
          return nameMatch ? nameMatch[1] : null;
        })
        .filter(name => name && !['name', 'version', 'description', 'main', 'scripts', 'keywords', 'author', 'license'].includes(name));

      // Check if packages are used in code (simple heuristic)
      const unusedPackages = declaredPackages.filter(pkg => {
        // Skip common utility packages that might not have direct imports
        const skipCheck = ['nodemon', 'eslint', 'prettier', 'jest', 'mocha', 'chai', 'typescript', 'webpack', 'vite', 'ts-node'];
        if (skipCheck.includes(pkg)) return false;

        // Check for require() or import statements
        const pkgName = pkg.replace('@', '').replace(/\//g, '-');
        const requirePattern = new RegExp(`require\\s*\\(\\s*['"]${pkg}['"]\\s*\\)`, 'i');
        const importPattern = new RegExp(`import\\s+.*\\s+from\\s+['"]${pkg}['"]`, 'i');

        return !requirePattern.test(code) && !importPattern.test(code);
      });

      if (unusedPackages.length > 0 && unusedPackages.length <= 5) {
        unusedPackages.forEach(pkg => {
          const issue = createIssue(
            'unused-dependency',
            SEVERITY.LOW,
            `Unused Dependency: ${pkg}`,
            `Package "${pkg}" is declared in dependencies but doesn't appear to be imported or required anywhere in your code. Unused dependencies increase bundle size, installation time, and attack surface. They also clutter your dependency tree.`,
            `If truly unused, remove it: npm uninstall ${pkg}. If it's used indirectly or in files not analyzed, you can ignore this warning. Consider using tools like depcheck to scan your entire project.`,
            null,
            'Dependencies'
          );
          issues.push(issue);
        });
      }
    }
  }

  // Rule 44: Missing Lock Files
  // This is a project-level check - we can only detect if code references lock files
  const hasLockFileReference = /package-lock\.json|yarn\.lock|pnpm-lock\.yaml/gi.test(code);
  const hasPackageJsonReference = /package\.json/gi.test(code);

  if (hasPackageJsonReference && !hasLockFileReference) {
    // Check if there's any mention of npm install without ci
    const hasNpmInstall = /npm\s+install(?!\s+--frozen-lockfile)/gi.test(code);
    if (hasNpmInstall || isPackageJson) {
      const issue = createIssue(
        'missing-lock-file',
        SEVERITY.MEDIUM,
        'Missing Dependency Lock File',
        'Your project may not have a lock file (package-lock.json, yarn.lock, or pnpm-lock.yaml). Without lock files, different team members and CI/CD environments may install different versions of dependencies, leading to "works on my machine" bugs and potential security issues.',
        'Generate a lock file: Run npm install (creates package-lock.json), yarn install (creates yarn.lock), or pnpm install (creates pnpm-lock.yaml). Commit the lock file to version control. Use npm ci instead of npm install in CI/CD for deterministic builds.',
        null,
        'Dependencies'
      );
      results.medium.push(issue);
      results.allIssues.push(issue);
    }
  }

  // Rule 45: Vulnerable Transitive Dependencies
  // Check for patterns indicating npm audit issues
  const hasAuditKeywords = /vulnerabilit|CVE-|security\s+advisory|high\s+severity|critical\s+severity/gi.test(code);
  const hasAuditCommand = /npm\s+audit(?!\s+fix)|yarn\s+audit/gi.test(code);

  if (hasAuditCommand || (isPackageJson && code.length > 500)) {
    const issue = createIssue(
      'potential-vulnerable-dependencies',
      SEVERITY.HIGH,
      'Potential Vulnerable Dependencies',
      'Your project may have dependencies with known security vulnerabilities. Transitive (indirect) dependencies can contain CVEs even if your direct dependencies are up-to-date. Attackers actively scan for and exploit known vulnerabilities.',
      'Run npm audit to check for vulnerabilities. Fix them with: npm audit fix (for compatible updates) or npm audit fix --force (for breaking changes). Review each vulnerability carefully. Consider using tools like Snyk or Dependabot for continuous monitoring.',
      null,
      'Dependencies'
    );
    results.high.push(issue);
    results.allIssues.push(issue);
  }

  // Additional check: Detect if npm audit output is pasted in code/comments
  lines.forEach((line, index) => {
    if (/\d+\s+vulnerabilit(y|ies)|found\s+\d+\s+(high|critical)/gi.test(line)) {
      const issue = createIssue(
        'vulnerabilities-detected',
        SEVERITY.CRITICAL,
        'Known Vulnerabilities Detected',
        'Your code contains output from npm audit showing known vulnerabilities. These are confirmed security issues that attackers can exploit. Critical and high-severity vulnerabilities pose immediate risk to your application and data.',
        'Fix all vulnerabilities immediately: Run npm audit fix. For breaking changes, use npm audit fix --force or manually update packages. Review the security advisories for each CVE. Test thoroughly after updates. Consider using npm audit --production to focus on production dependencies.',
        index + 1,
        'Dependencies'
      );
      issues.push(issue);
    }
  });

  // Add all dependency issues
  issues.forEach(issue => {
    if (issue.severity === SEVERITY.CRITICAL) {
      results.critical.push(issue);
    } else if (issue.severity === SEVERITY.HIGH) {
      results.high.push(issue);
    } else if (issue.severity === SEVERITY.MEDIUM) {
      results.medium.push(issue);
    } else if (issue.severity === SEVERITY.LOW) {
      results.low.push(issue);
    }
    results.allIssues.push(issue);
  });

  results.stats.rulesChecked += 5; // Rules 41-45
}

/**
 * Category 8: CI/CD Security (Rules 63-66)
 */
function detectCICDIssues(code, lines, results, language) {
  const issues = [];

  // Detect if this is CI/CD configuration file or contains CI/CD code
  const isCIConfig = code.includes('.github/workflows') ||
                     code.includes('.gitlab-ci.yml') ||
                     code.includes('.travis.yml') ||
                     code.includes('Jenkinsfile') ||
                     code.includes('azure-pipelines') ||
                     code.includes('circle') ||
                     code.includes('GITHUB_TOKEN') ||
                     code.includes('CI=true') ||
                     /\$\{\{\s*secrets\./gi.test(code) ||
                     /\$\{\{\s*env\./gi.test(code);

  // Rule 63: Secrets in CI/CD Logs - CRITICAL
  const secretLoggingPatterns = [
    /echo\s+["']?\$\{?\{?\s*secrets\./gi,
    /echo\s+["']?\$\w*(?:SECRET|PASSWORD|TOKEN|KEY)/gi,
    /console\.log\s*\(\s*process\.env\.(?:SECRET|PASSWORD|TOKEN|KEY)/gi,
    /print\s*\(\s*os\.getenv\s*\(\s*['"](?:SECRET|PASSWORD|TOKEN|KEY)/gi,
    /echo\s+["']?\$(?:API_KEY|SECRET_KEY|PASSWORD)/gi,
    /\$\{\{\s*secrets\.\w+\s*\}\}\s*>>/gi  // Secrets written to files
  ];

  lines.forEach((line, index) => {
    secretLoggingPatterns.forEach(pattern => {
      if (safeTest(pattern, line)) {
        // Skip if it's a comment or explicitly masked
        if (line.trim().startsWith('#') || line.trim().startsWith('//') || line.includes('***')) {
          return;
        }

        const issue = createIssue(
          'secrets-in-ci-logs',
          SEVERITY.CRITICAL,
          'Secrets Exposed in CI/CD Logs',
          'Your CI/CD configuration prints secrets to logs using echo, console.log, or similar commands. CI/CD logs are often publicly accessible (especially on public repos) and are stored indefinitely. Anyone with access to build logs can see your secrets in plain text.',
          'Never echo or log secrets. If you need to verify they exist, use: echo "Secret is set" instead of echo $SECRET. For GitHub Actions, secrets are automatically masked UNLESS you explicitly print them. Remove all echo/console.log statements that output ${{ secrets.* }} or environment variables containing secrets.',
          index + 1,
          'CI/CD'
        );
        issues.push(issue);
      }
    });
  });

  // Additional check: Detecting secrets passed to commands that might log them
  const dangerousCommandPatterns = [
    /curl.*\$\{?\{?\s*secrets\./gi,
    /wget.*\$\{?\{?\s*secrets\./gi,
    /git\s+clone.*\$\{?\{?\s*secrets\./gi,
    /npm\s+publish.*\$\{?\{?\s*secrets\./gi
  ];

  lines.forEach((line, index) => {
    dangerousCommandPatterns.forEach(pattern => {
      if (safeTest(pattern, line)) {
        const issue = createIssue(
          'secrets-in-command-args',
          SEVERITY.HIGH,
          'Secrets in Command Arguments',
          'Secrets are being passed as command-line arguments (curl, wget, git, etc.). Command arguments are often logged by the shell, process monitors, and system audit logs. This exposes secrets even if your CI logs are private.',
          'Pass secrets via environment variables or stdin instead of command arguments. For curl: use -H "Authorization: Bearer $TOKEN" with TOKEN as env var. For git: use credential helpers. For npm: use .npmrc with environment variables.',
          index + 1,
          'CI/CD'
        );
        issues.push(issue);
      }
    });
  });

  // Rule 64: Unverified Dependencies in CI - HIGH
  const unsafeInstallPatterns = [
    /npm\s+install(?!\s+--frozen-lockfile)(?!\s+-g)(?!\s+--ignore-scripts)/gi,
    /yarn\s+install(?!\s+--frozen-lockfile)(?!\s+--immutable)/gi,
    /pip\s+install(?!\s+-r\s+requirements\.txt)/gi,
    /pip\s+install(?!.*--require-hashes)/gi,
    /composer\s+install(?!\s+--no-scripts)/gi,
    /bundle\s+install(?!\s+--frozen)/gi
  ];

  if (isCIConfig) {
    lines.forEach((line, index) => {
      // Skip comments
      if (line.trim().startsWith('#') || line.trim().startsWith('//')) {
        return;
      }

      unsafeInstallPatterns.forEach(pattern => {
        if (safeTest(pattern, line)) {
          const issue = createIssue(
            'unverified-dependencies-ci',
            SEVERITY.HIGH,
            'Unverified Dependencies in CI Pipeline',
            'Your CI pipeline installs dependencies without verifying exact versions from lock files. This means builds can get different versions at different times, leading to supply chain attacks where malicious code is installed after your last test. Attackers can compromise packages between your dev testing and production deployment.',
            'Use lock file verification in CI: npm ci (not npm install), yarn install --frozen-lockfile, pip install --require-hashes. These commands fail if lock file doesn\'t match package.json, ensuring reproducible builds and preventing supply chain attacks.',
            index + 1,
            'CI/CD'
          );
          issues.push(issue);
        }
      });
    });
  }

  // Check for downloading and executing remote scripts
  const remoteScriptPatterns = [
    /curl.*\|\s*(?:bash|sh|python)/gi,
    /wget.*-O-.*\|\s*(?:bash|sh|python)/gi,
    /curl.*-s.*\|\s*sudo\s+(?:bash|sh)/gi,
    /\|\s*sh\s*$/gm
  ];

  lines.forEach((line, index) => {
    remoteScriptPatterns.forEach(pattern => {
      if (safeTest(pattern, line)) {
        const issue = createIssue(
          'remote-script-execution',
          SEVERITY.HIGH,
          'Downloading and Executing Remote Scripts',
          'Your CI pipeline downloads and immediately executes scripts from the internet (curl | bash). If the source is compromised or hijacked, malicious code runs in your CI with full access to your secrets, code, and deployment credentials. This is a common supply chain attack vector.',
          'Never pipe downloads directly to bash/sh. Download first, verify integrity (checksum/signature), then execute. Example: curl -o script.sh URL && sha256sum -c script.sh.checksum && bash script.sh. Better: vendor scripts in your repo or use official Docker images.',
          index + 1,
          'CI/CD'
        );
        issues.push(issue);
      }
    });
  });

  // Rule 65: Missing Security Scans in Pipeline - MEDIUM
  if (isCIConfig) {
    const hasSecurityScan = /npm\s+audit/gi.test(code) ||
                           /yarn\s+audit/gi.test(code) ||
                           /snyk\s+test/gi.test(code) ||
                           /trivy/gi.test(code) ||
                           /safety\s+check/gi.test(code) ||  // Python
                           /bandit/gi.test(code) ||  // Python
                           /gosec/gi.test(code) ||  // Go
                           /brakeman/gi.test(code) ||  // Ruby
                           /semgrep/gi.test(code) ||
                           /dependabot/gi.test(code) ||
                           /codeql/gi.test(code) ||
                           /SAST|DAST|security.*scan/gi.test(code);

    const hasBuildStep = /npm\s+(run\s+)?build/gi.test(code) ||
                        /yarn\s+(run\s+)?build/gi.test(code) ||
                        /mvn\s+package/gi.test(code) ||
                        /gradle\s+build/gi.test(code) ||
                        /make\s+build/gi.test(code) ||
                        /docker\s+build/gi.test(code);

    if (hasBuildStep && !hasSecurityScan) {
      const issue = createIssue(
        'missing-security-scans',
        SEVERITY.MEDIUM,
        'Missing Security Scans in CI Pipeline',
        'Your CI pipeline builds and potentially deploys code without running security scans. Vulnerabilities, secrets, and security issues can reach production undetected. Security scans in CI are your last line of defense before deployment.',
        'Add security scanning to your CI pipeline: 1) npm audit or yarn audit for dependencies, 2) Snyk or Dependabot for vulnerability scanning, 3) Semgrep or CodeQL for SAST (static analysis), 4) Git-secrets or TruffleHog for secret scanning. Run these before build/deploy steps and fail the build on critical issues.',
        null,
        'CI/CD'
      );
      results.medium.push(issue);
      results.allIssues.push(issue);
    }
  }

  // Rule 66: Overly Permissive CI Tokens - HIGH
  const broadPermissionPatterns = [
    /permissions:\s*write-all/gi,
    /permissions:\s*[^\n]*:\s*write[^\n]*:\s*write/gi,  // Multiple write permissions
    /GITHUB_TOKEN.*with:\s*repo/gi,
    /token:\s*\$\{\{\s*secrets\.GITHUB_TOKEN\s*\}\}/gi
  ];

  if (isCIConfig && code.includes('GITHUB_TOKEN')) {
    lines.forEach((line, index) => {
      broadPermissionPatterns.forEach(pattern => {
        if (safeTest(pattern, line)) {
          const issue = createIssue(
            'overly-permissive-ci-token',
            SEVERITY.HIGH,
            'Overly Permissive CI Token Permissions',
            'Your CI workflow uses broad permissions (write-all or multiple write scopes) for the GitHub token. If the workflow is compromised or a malicious dependency runs in CI, it can modify your code, create releases, access secrets, or take over your repository.',
            'Use minimal permissions principle: Only grant specific permissions needed. Example: permissions: { contents: read, pull-requests: write }. Avoid write-all. For GitHub Actions, default GITHUB_TOKEN has limited permissions. Only escalate when absolutely necessary and document why.',
            index + 1,
            'CI/CD'
          );
          issues.push(issue);
        }
      });
    });
  }

  // Check for tokens with full repo access being used broadly
  const fullAccessPatterns = [
    /secrets\.(?!GITHUB_TOKEN)[A-Z_]*TOKEN/gi,
    /secrets\.(?!GITHUB_TOKEN)[A-Z_]*KEY/gi
  ];

  if (isCIConfig) {
    lines.forEach((line, index) => {
      fullAccessPatterns.forEach(pattern => {
        const matches = line.match(pattern);
        if (matches && matches.length > 2) {  // Multiple different tokens used
          const issue = createIssue(
            'multiple-powerful-tokens',
            SEVERITY.MEDIUM,
            'Multiple Powerful Tokens in CI',
            'Your CI workflow uses multiple different tokens/keys. Each token is a potential attack vector. If any step in your workflow is compromised (malicious dependency, typosquatting), all tokens are exposed.',
            'Minimize the number of tokens used in CI. Use the default GITHUB_TOKEN when possible. For external services, create service-specific tokens with minimal permissions. Use separate workflows for different permission levels rather than one workflow with many tokens.',
            index + 1,
            'CI/CD'
          );
          issues.push(issue);
        }
      });
    });
  }

  // Check for running CI on pull requests from forks (security risk)
  if (isCIConfig) {
    const hasExternalPRTrigger = /pull_request_target/gi.test(code) ||
                                 /on:.*pull_request.*external/gi.test(code);
    const hasSecretsInPR = /pull_request/.test(code) && /secrets\./gi.test(code);

    if (hasExternalPRTrigger || hasSecretsInPR) {
      const issue = createIssue(
        'secrets-exposed-to-forks',
        SEVERITY.CRITICAL,
        'Secrets Accessible to Fork Pull Requests',
        'Your workflow runs on pull_request_target or exposes secrets to PRs from forks. Attackers can create a pull request from a forked repo with malicious code that steals your secrets. This is a critical GitHub Actions security issue that has led to many compromises.',
        'Never use pull_request_target with secrets unless you thoroughly validate PR code first. Use pull_request instead (doesn\'t expose secrets to forks). If you must use pull_request_target: 1) Checkout the base branch, not PR branch, 2) Validate PR changes before running them, 3) Use a separate workflow without secrets for PRs.',
        null,
        'CI/CD'
      );
      results.critical.push(issue);
      results.allIssues.push(issue);
    }
  }

  // Add all CI/CD issues
  issues.forEach(issue => {
    if (issue.severity === SEVERITY.CRITICAL) {
      results.critical.push(issue);
    } else if (issue.severity === SEVERITY.HIGH) {
      results.high.push(issue);
    } else if (issue.severity === SEVERITY.MEDIUM) {
      results.medium.push(issue);
    } else if (issue.severity === SEVERITY.LOW) {
      results.low.push(issue);
    }
    results.allIssues.push(issue);
  });

  results.stats.rulesChecked += 4; // Rules 63-66
}

/**
 * Category 9: Code Quality & Performance (Rules 67-72)
 */
function detectCodeQualityPerformance(code, lines, results, language) {
  const issues = [];

  // Rule 67: Blocking Operations in Event Loop - HIGH
  const blockingOperations = [
    { pattern: /fs\.readFileSync\s*\(/gi, name: 'fs.readFileSync' },
    { pattern: /fs\.writeFileSync\s*\(/gi, name: 'fs.writeFileSync' },
    { pattern: /fs\.existsSync\s*\(/gi, name: 'fs.existsSync' },
    { pattern: /fs\.readdirSync\s*\(/gi, name: 'fs.readdirSync' },
    { pattern: /fs\.statSync\s*\(/gi, name: 'fs.statSync' },
    { pattern: /crypto\.pbkdf2Sync\s*\(/gi, name: 'crypto.pbkdf2Sync' },
    { pattern: /crypto\.scryptSync\s*\(/gi, name: 'crypto.scryptSync' },
    { pattern: /child_process\.execSync\s*\(/gi, name: 'execSync' },
    { pattern: /child_process\.spawnSync\s*\(/gi, name: 'spawnSync' },
    { pattern: /Atomics\.wait\s*\(/gi, name: 'Atomics.wait' }
  ];

  lines.forEach((line, index) => {
    blockingOperations.forEach(({ pattern, name }) => {
      if (safeTest(pattern, line)) {
        // Skip if it's in a comment
        if (line.trim().startsWith('//') || line.trim().startsWith('*') || line.trim().startsWith('#')) {
          return;
        }

        const issue = createIssue(
          'blocking-operation',
          SEVERITY.HIGH,
          'Blocking Synchronous Operation',
          `Code uses ${name}, a synchronous operation that blocks the entire event loop. In Node.js, this freezes your server for ALL users while the operation completes. If the file is large or the operation is slow, your entire application becomes unresponsive.`,
          `Replace ${name} with its async version. For example: use fs.readFile() with async/await instead of fs.readFileSync(). This allows Node.js to handle other requests while waiting for I/O operations to complete.`,
          index + 1,
          'Performance'
        );
        issues.push(issue);
      }
    });
  });

  // Rule 68: Memory Leaks - MEDIUM
  const memoryLeakPatterns = [
    {
      pattern: /addEventListener\s*\([^)]+\)/gi,
      antiPattern: /removeEventListener/gi,
      name: 'Event listener not removed'
    },
    {
      pattern: /setInterval\s*\(/gi,
      antiPattern: /clearInterval/gi,
      name: 'setInterval not cleared'
    },
    {
      pattern: /setTimeout\s*\(/gi,
      antiPattern: /clearTimeout/gi,
      name: 'setTimeout not cleared',
      severity: 'low' // setTimeout is less critical than setInterval
    }
  ];

  // Check for event listeners without removeEventListener in same file
  if (/addEventListener\s*\(/gi.test(code) && !/removeEventListener/gi.test(code)) {
    const issue = createIssue(
      'memory-leak-event-listener',
      SEVERITY.MEDIUM,
      'Potential Memory Leak: Event Listener Not Removed',
      'Code adds event listeners but never removes them. In React/Vue components or SPA routes, this creates memory leaks. Each time the component mounts, a new listener is added, but old ones stay in memory forever.',
      'Remove event listeners in cleanup (React useEffect return, Vue beforeDestroy, or vanilla JS cleanup). Example: const handler = () => {...}; element.addEventListener("click", handler); return () => element.removeEventListener("click", handler);',
      0,
      'Performance'
    );
    issues.push(issue);
  }

  // Check for setInterval without clearInterval
  if (/setInterval\s*\(/gi.test(code) && !/clearInterval/gi.test(code)) {
    const issue = createIssue(
      'memory-leak-interval',
      SEVERITY.MEDIUM,
      'Potential Memory Leak: setInterval Not Cleared',
      'Code uses setInterval but never calls clearInterval. This creates memory leaks and keeps the interval running even after the component unmounts, potentially causing errors or performance degradation.',
      'Always clear intervals in cleanup. Example: const id = setInterval(() => {...}, 1000); return () => clearInterval(id);',
      0,
      'Performance'
    );
    issues.push(issue);
  }

  // Check for global variable accumulation patterns
  const globalAccumulationPatterns = [
    /window\.\w+\s*=\s*\[\]/gi,
    /window\.\w+\.push\s*\(/gi,
    /global\.\w+\s*=\s*\[\]/gi
  ];

  lines.forEach((line, index) => {
    globalAccumulationPatterns.forEach(pattern => {
      if (safeTest(pattern, line)) {
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
          return;
        }

        const issue = createIssue(
          'global-accumulation',
          SEVERITY.LOW,
          'Global Variable Accumulation',
          'Code accumulates data in global variables (window/global). Over time, this consumes more and more memory. In long-running applications or SPAs, this can cause the page to slow down or crash.',
          'Avoid storing growing data structures in global scope. Use local state, clean up old data, or implement pagination/virtualization for large lists.',
          index + 1,
          'Performance'
        );
        issues.push(issue);
      }
    });
  });

  // Rule 69: N+1 Query Problems - MEDIUM
  const databaseQueryPatterns = [
    /\.find\s*\(/gi,
    /\.findOne\s*\(/gi,
    /\.findById\s*\(/gi,
    /\.query\s*\(/gi,
    /\.exec\s*\(/gi,
    /SELECT\s+.*\s+FROM/gi,
    /db\./gi,
    /\.get\s*\(/gi
  ];

  const loopPatterns = [
    /for\s*\(/gi,
    /forEach\s*\(/gi,
    /\.map\s*\(/gi,
    /while\s*\(/gi
  ];

  lines.forEach((line, index) => {
    const hasLoop = loopPatterns.some(pattern => safeTest(pattern, line));

    // Check next few lines for database queries inside loops
    if (hasLoop && index < lines.length - 5) {
      const nextLines = lines.slice(index + 1, index + 6).join('\n');
      const hasQuery = databaseQueryPatterns.some(pattern => safeTest(pattern, nextLines));

      if (hasQuery) {
        const issue = createIssue(
          'n-plus-one-query',
          SEVERITY.MEDIUM,
          'N+1 Query Problem',
          'Code executes database queries inside a loop. If the loop runs 100 times, you make 100+ database calls. This is extremely slow - a page that should load in 50ms can take 10+ seconds. Instagram had this bug in 2013 and their feed took minutes to load.',
          'Use batch loading or eager loading. For SQL: use JOIN. For ORMs: use .populate() or .include(). For GraphQL: use DataLoader. Load all data in ONE query, then process in memory.',
          index + 1,
          'Performance'
        );
        issues.push(issue);
      }
    }
  });

  // Also check for fetch/axios in loops
  const apiCallPatterns = [
    /fetch\s*\(/gi,
    /axios\./gi,
    /http\.get\s*\(/gi,
    /request\s*\(/gi
  ];

  lines.forEach((line, index) => {
    const hasLoop = loopPatterns.some(pattern => safeTest(pattern, line));

    if (hasLoop && index < lines.length - 5) {
      const nextLines = lines.slice(index + 1, index + 6).join('\n');
      const hasAPICall = apiCallPatterns.some(pattern => safeTest(pattern, nextLines));

      if (hasAPICall) {
        const issue = createIssue(
          'api-calls-in-loop',
          SEVERITY.MEDIUM,
          'API Calls in Loop',
          'Code makes API calls inside a loop. This causes severe performance problems and can hit rate limits. If you loop 100 times, you make 100 HTTP requests sequentially, which could take 10+ seconds.',
          'Batch API calls using Promise.all() or the API\'s batch endpoint. Example: const promises = items.map(item => fetch(url + item.id)); const results = await Promise.all(promises);',
          index + 1,
          'Performance'
        );
        issues.push(issue);
      }
    }
  });

  // Rule 70: ReDoS - Inefficient Regular Expressions - MEDIUM
  const redosPatterns = [
    { pattern: /\/\(.*\*.*\)\*\+/g, name: 'Nested quantifiers (.*)*' },
    { pattern: /\/\(.*\+.*\)\+/g, name: 'Nested quantifiers (.+)+' },
    { pattern: /\/\(.*\{.*,.*\}.*\)\+/g, name: 'Nested quantifiers with repetition' },
    { pattern: /\/\(.*\|.*\)\*.*\(.*\|.*\)\*/g, name: 'Multiple alternations with quantifiers' }
  ];

  lines.forEach((line, index) => {
    // Look for regex patterns with catastrophic backtracking
    const regexPatterns = line.match(/\/[^\/]+\/[gimsuy]*/g);

    if (regexPatterns) {
      regexPatterns.forEach(regex => {
        // Check for dangerous patterns
        if (/\(.*[*+].*\)[*+]/.test(regex)) {
          const issue = createIssue(
            'redos-vulnerability',
            SEVERITY.MEDIUM,
            'ReDoS: Inefficient Regular Expression',
            'Regular expression uses nested quantifiers (like (a+)+ or (a*)*) which can cause catastrophic backtracking. Attackers can send specially crafted strings that make your regex take exponentially longer to process, causing DoS.',
            'Simplify the regex to avoid nested quantifiers. Use atomic groups or possessive quantifiers if available. Test regex with long strings. Consider using a regex analysis tool like safe-regex.',
            index + 1,
            'Performance'
          );
          issues.push(issue);
        }
      });
    }
  });

  // Rule 71: Large Bundle Size Anti-patterns - LOW
  const bundleSizeAntiPatterns = [
    {
      pattern: /import\s+\*\s+as\s+\w+\s+from\s+['"]lodash['"]/gi,
      name: 'lodash',
      fix: 'import individual functions'
    },
    {
      pattern: /import.+from\s+['"]moment['"]/gi,
      name: 'moment',
      fix: 'use date-fns or dayjs instead'
    },
    {
      pattern: /import\s+\*\s+as\s+\w+\s+from\s+['"]@mui\/icons-material['"]/gi,
      name: '@mui/icons-material',
      fix: 'import individual icons'
    },
    {
      pattern: /require\s*\(\s*['"]lodash['"]\s*\)/gi,
      name: 'lodash',
      fix: 'require individual functions'
    }
  ];

  lines.forEach((line, index) => {
    bundleSizeAntiPatterns.forEach(({ pattern, name, fix }) => {
      if (safeTest(pattern, line)) {
        const issue = createIssue(
          'large-bundle-import',
          SEVERITY.LOW,
          'Large Bundle Import',
          `Code imports the entire ${name} library instead of specific functions. This adds hundreds of KB to your bundle size, making your app slower to load. Users on slow connections will wait much longer.`,
          `${fix}. For lodash: import debounce from 'lodash/debounce' instead of import _ from 'lodash'. For moment: switch to date-fns (2KB) or dayjs (2KB) instead of moment (67KB).`,
          index + 1,
          'Performance'
        );
        issues.push(issue);
      }
    });
  });

  // Rule 72: Console Logs in Production - LOW
  const consolePatterns = [
    /console\.log\s*\(/gi,
    /console\.debug\s*\(/gi,
    /console\.info\s*\(/gi,
    /console\.warn\s*\(/gi,
    /console\.error\s*\(/gi,
    /console\.trace\s*\(/gi,
    /console\.table\s*\(/gi
  ];

  // Only flag if there's no obvious guard
  const hasProductionGuard = /process\.env\.NODE_ENV.*production/gi.test(code) ||
                             /process\.env\.NODE_ENV.*development/gi.test(code) ||
                             /__DEV__/gi.test(code);

  if (!hasProductionGuard) {
    let consoleCount = 0;
    lines.forEach((line, index) => {
      // Skip comments
      if (line.trim().startsWith('//') || line.trim().startsWith('*') || line.trim().startsWith('#')) {
        return;
      }

      consolePatterns.forEach(pattern => {
        if (safeTest(pattern, line)) {
          consoleCount++;

          // Only report first few instances
          if (consoleCount <= 3) {
            const issue = createIssue(
              'console-in-production',
              SEVERITY.LOW,
              'Console Logs in Production Code',
              'Code has console.log statements without production guards. These logs expose internal debugging info to users, cause minor performance overhead, and clutter the browser console in production.',
              'Wrap console logs in development checks: if (process.env.NODE_ENV !== "production") { console.log(...) }. Or use a logging library that automatically strips logs in production builds. Many bundlers (Webpack, Vite) can remove console.* in production config.',
              index + 1,
              'Code Quality'
            );
            issues.push(issue);
          }
        }
      });
    });
  }

  // Add all issues to results
  issues.forEach(issue => {
    if (issue.severity === 'CRITICAL') {
      results.critical.push(issue);
    } else if (issue.severity === 'HIGH') {
      results.high.push(issue);
    } else if (issue.severity === 'MEDIUM') {
      results.medium.push(issue);
    } else {
      results.low.push(issue);
    }
    results.allIssues.push(issue);
  });

  results.stats.rulesChecked += 6; // Rules 67-72
}

/**
 * Category 10: Infrastructure & Cloud Security (Rules 46-58)
 */
function detectInfrastructureCloudSecurity(code, lines, results, language) {
  const issues = [];

  // Rule 46: Exposed Cloud Credentials - CRITICAL
  const cloudCredentialPatterns = [
    { pattern: /aws_access_key_id\s*=\s*['"]\w{20}['"]/gi, name: 'AWS Access Key', service: 'AWS' },
    { pattern: /aws_secret_access_key\s*=\s*['"]\w{40}['"]/gi, name: 'AWS Secret Key', service: 'AWS' },
    { pattern: /AKIA[0-9A-Z]{16}/gi, name: 'AWS Access Key ID', service: 'AWS' },
    { pattern: /gcloud\s+auth\s+activate-service-account.*--key-file/gi, name: 'GCP Service Account', service: 'GCP' },
    { pattern: /GOOGLE_APPLICATION_CREDENTIALS\s*=\s*['"]/gi, name: 'GCP Credentials Path', service: 'GCP' },
    { pattern: /azure_client_id\s*=\s*['"]/gi, name: 'Azure Client ID', service: 'Azure' },
    { pattern: /azure_client_secret\s*=\s*['"]/gi, name: 'Azure Client Secret', service: 'Azure' }
  ];

  lines.forEach((line, index) => {
    cloudCredentialPatterns.forEach(({ pattern, name, service }) => {
      if (safeTest(pattern, line) && !line.trim().startsWith('//') && !line.trim().startsWith('#')) {
        const issue = createIssue(
          'exposed-cloud-credentials',
          SEVERITY.CRITICAL,
          `Exposed ${service} Credentials`,
          `Code contains hardcoded ${service} credentials (${name}). These credentials provide access to your cloud infrastructure and can be used to: create/delete resources, access databases, read/write files in storage buckets, rack up massive bills, or steal sensitive data.`,
          `Store cloud credentials in environment variables or use cloud-native authentication (IAM roles for AWS, Service Accounts for GCP, Managed Identity for Azure). Never hardcode credentials in code. Use: process.env.AWS_ACCESS_KEY_ID instead of hardcoding the value.`,
          index + 1,
          'Cloud Security'
        );
        issues.push(issue);
      }
    });
  });

  // Rule 47: Overly Permissive IAM Policies - HIGH
  const permissiveIAMPatterns = [
    { pattern: /"Effect":\s*"Allow"[^}]*"Action":\s*"\*"/gi, name: 'AWS IAM wildcard action' },
    { pattern: /"Effect":\s*"Allow"[^}]*"Resource":\s*"\*"/gi, name: 'AWS IAM wildcard resource' },
    { pattern: /Action:\s*\*\s*$/gm, name: 'Wildcard IAM action' },
    { pattern: /Resource:\s*\*\s*$/gm, name: 'Wildcard IAM resource' },
    { pattern: /"roles\/owner"/gi, name: 'GCP Owner role' },
    { pattern: /"roles\/editor"/gi, name: 'GCP Editor role' },
    { pattern: /--role\s+Owner/gi, name: 'Owner role assignment' }
  ];

  lines.forEach((line, index) => {
    permissiveIAMPatterns.forEach(({ pattern, name }) => {
      if (safeTest(pattern, line)) {
        const issue = createIssue(
          'overly-permissive-iam',
          SEVERITY.HIGH,
          'Overly Permissive IAM Policy',
          `IAM policy grants excessive permissions (${name}). This violates the principle of least privilege. If these credentials are compromised, attackers have unrestricted access to your cloud resources - they can delete databases, steal data, or create expensive compute instances.`,
          `Grant only the minimum permissions needed. Instead of Action: "*", list specific actions like ["s3:GetObject", "s3:PutObject"]. Instead of Resource: "*", specify exact resources like "arn:aws:s3:::my-bucket/*". Use separate roles for different permissions levels.`,
          index + 1,
          'Cloud Security'
        );
        issues.push(issue);
      }
    });
  });

  // Rule 48: Unencrypted Cloud Storage - HIGH
  const unencryptedStoragePatterns = [
    { pattern: /"Encrypted":\s*false/gi, name: 'Disabled encryption flag' },
    { pattern: /encryption\s*=\s*false/gi, name: 'Encryption disabled' },
    { pattern: /ServerSideEncryption.*None/gi, name: 'No server-side encryption' },
    { pattern: /sse_algorithm\s*=\s*""/gi, name: 'Empty SSE algorithm' },
    { pattern: /PublicRead|PublicReadWrite/gi, name: 'Public bucket ACL' },
    { pattern: /"BlockPublicAcls":\s*false/gi, name: 'Public ACLs allowed' }
  ];

  lines.forEach((line, index) => {
    unencryptedStoragePatterns.forEach(({ pattern, name }) => {
      if (safeTest(pattern, line)) {
        const issue = createIssue(
          'unencrypted-cloud-storage',
          SEVERITY.HIGH,
          'Unencrypted Cloud Storage',
          `Cloud storage bucket is configured without encryption (${name}). Data at rest is stored in plaintext. If an attacker gains access to the physical storage or cloud account, they can read all stored data. This violates compliance requirements (GDPR, HIPAA, PCI-DSS).`,
          `Enable server-side encryption. AWS S3: enable AES-256 or KMS encryption. GCP Storage: enable CMEK or Google-managed encryption. Azure Blob: enable Storage Service Encryption. Set encryption at bucket/container creation and enforce it via policy.`,
          index + 1,
          'Cloud Security'
        );
        issues.push(issue);
      }
    });
  });

  // Rule 49: Missing Security Groups / Firewall Rules - MEDIUM
  const missingFirewallPatterns = [
    { pattern: /ingress.*0\.0\.0\.0\/0/gi, name: 'Ingress from any IP' },
    { pattern: /source_ranges\s*=\s*\["0\.0\.0\.0\/0"\]/gi, name: 'Source range 0.0.0.0/0' },
    { pattern: /CidrIp:\s*0\.0\.0\.0\/0/gi, name: 'CIDR block open to internet' },
    { pattern: /from_port\s*=\s*0.*to_port\s*=\s*65535/gi, name: 'All ports open' }
  ];

  lines.forEach((line, index) => {
    missingFirewallPatterns.forEach(({ pattern, name }) => {
      if (safeTest(pattern, line)) {
        const issue = createIssue(
          'overly-permissive-firewall',
          SEVERITY.MEDIUM,
          'Overly Permissive Firewall Rules',
          `Firewall/security group allows traffic from any IP (${name}). This exposes services to the entire internet, increasing attack surface. Attackers can scan for vulnerabilities, attempt brute force attacks, or exploit unpatched services.`,
          `Restrict ingress to specific IP ranges. Use VPN or bastion hosts for admin access. Only allow 0.0.0.0/0 for public-facing services (web servers on port 80/443). Use security group references instead of CIDR blocks when possible.`,
          index + 1,
          'Cloud Security'
        );
        issues.push(issue);
      }
    });
  });

  // Rule 50: Container Running as Root - MEDIUM
  const containerRootPatterns = [
    { pattern: /USER\s+root/gi, name: 'Dockerfile USER root' },
    { pattern: /runAsUser:\s*0/gi, name: 'Kubernetes runAsUser: 0' },
    { pattern: /privileged:\s*true/gi, name: 'Privileged container' },
    { pattern: /--privileged/gi, name: 'Docker run --privileged' },
    { pattern: /securityContext:.*privileged:\s*true/gi, name: 'Security context privileged' }
  ];

  lines.forEach((line, index) => {
    containerRootPatterns.forEach(({ pattern, name }) => {
      if (safeTest(pattern, line) && !line.includes('runAsNonRoot')) {
        const issue = createIssue(
          'container-running-as-root',
          SEVERITY.MEDIUM,
          'Container Running as Root',
          `Container is configured to run as root user (${name}). If the container is compromised, attackers have root privileges and can: escape the container, access host filesystem, install malware, or pivot to other containers.`,
          `Run containers as non-root user. Dockerfile: add "USER 1000" or create a non-root user. Kubernetes: set securityContext.runAsNonRoot: true and runAsUser: 1000. Remove privileged: true unless absolutely necessary.`,
          index + 1,
          'Container Security'
        );
        issues.push(issue);
      }
    });
  });

  // Rule 51: Exposed Docker Daemon - CRITICAL
  const exposedDockerPatterns = [
    { pattern: /-H\s+tcp:\/\/0\.0\.0\.0/gi, name: 'Docker daemon on 0.0.0.0' },
    { pattern: /dockerd.*-H.*0\.0\.0\.0/gi, name: 'dockerd exposed' },
    { pattern: /DOCKER_HOST.*tcp:\/\/[^:]+:2375/gi, name: 'Docker on port 2375 (unencrypted)' },
    { pattern: /\/var\/run\/docker\.sock/gi, name: 'Docker socket mounted' }
  ];

  lines.forEach((line, index) => {
    exposedDockerPatterns.forEach(({ pattern, name }) => {
      if (safeTest(pattern, line)) {
        const issue = createIssue(
          'exposed-docker-daemon',
          SEVERITY.CRITICAL,
          'Exposed Docker Daemon',
          `Docker daemon is exposed (${name}). Anyone with network access can connect to Docker and: run privileged containers, access host filesystem, read secrets from all containers, or achieve full host compromise. This is a critical vulnerability.`,
          `Never expose Docker daemon to network. Use Unix socket (/var/run/docker.sock) with proper permissions. If remote access is needed, use SSH tunneling or Docker over TLS (port 2376 with certificates). Never use -H tcp://0.0.0.0:2375.`,
          index + 1,
          'Container Security'
        );
        issues.push(issue);
      }
    });
  });

  // Rule 52: Missing Container Resource Limits - LOW
  const missingResourceLimits = /resources:/gi.test(code);
  const hasLimits = /limits:/gi.test(code) && /requests:/gi.test(code);

  if (missingResourceLimits && !hasLimits) {
    const issue = createIssue(
      'missing-resource-limits',
      SEVERITY.LOW,
      'Missing Container Resource Limits',
      'Kubernetes containers lack resource limits (memory/CPU). A single container can consume all host resources, causing DoS for other containers. Attackers can exploit this by running resource-intensive operations.',
      'Set resource requests and limits in Kubernetes manifests: resources: { requests: { memory: "128Mi", cpu: "100m" }, limits: { memory: "256Mi", cpu: "200m" } }. This prevents resource exhaustion attacks.',
      0,
      'Container Security'
    );
    issues.push(issue);
  }

  // Rule 53: Insecure Kubernetes Configurations - HIGH
  const k8sInsecurePatterns = [
    { pattern: /automountServiceAccountToken:\s*true/gi, name: 'Service account token auto-mounted' },
    { pattern: /hostNetwork:\s*true/gi, name: 'Host network enabled' },
    { pattern: /hostPID:\s*true/gi, name: 'Host PID namespace' },
    { pattern: /hostIPC:\s*true/gi, name: 'Host IPC namespace' },
    { pattern: /allowPrivilegeEscalation:\s*true/gi, name: 'Privilege escalation allowed' }
  ];

  lines.forEach((line, index) => {
    k8sInsecurePatterns.forEach(({ pattern, name }) => {
      if (safeTest(pattern, line)) {
        const issue = createIssue(
          'insecure-kubernetes-config',
          SEVERITY.HIGH,
          'Insecure Kubernetes Configuration',
          `Kubernetes pod has insecure configuration (${name}). This grants excessive privileges to containers, allowing attackers who compromise a pod to access the host or other pods, escalate privileges, or steal service account tokens.`,
          `Use restrictive pod security policies. Set automountServiceAccountToken: false unless needed. Avoid hostNetwork, hostPID, hostIPC. Set allowPrivilegeEscalation: false in securityContext. Use network policies to isolate pods.`,
          index + 1,
          'Kubernetes Security'
        );
        issues.push(issue);
      }
    });
  });

  // Rule 54: Missing Network Policies - MEDIUM
  const hasNetworkPolicy = /kind:\s*NetworkPolicy/gi.test(code);
  const hasK8sDeployment = /kind:\s*Deployment/gi.test(code) || /kind:\s*Pod/gi.test(code);

  if (hasK8sDeployment && !hasNetworkPolicy) {
    const issue = createIssue(
      'missing-network-policies',
      SEVERITY.MEDIUM,
      'Missing Kubernetes Network Policies',
      'Kubernetes cluster lacks network policies. By default, all pods can communicate with all other pods. If one pod is compromised, attackers can lateral-move to any other pod, access databases directly, or exfiltrate data.',
      'Implement NetworkPolicy resources to control pod-to-pod traffic. Start with default-deny: block all traffic, then explicitly allow required connections. Use labels to define ingress/egress rules for each microservice.',
      0,
      'Kubernetes Security'
    );
    issues.push(issue);
  }

  // Rule 55: API Endpoints Without Authentication - HIGH
  const unauthenticatedAPIPatterns = [
    { pattern: /app\.(get|post|put|delete|patch)\s*\([^)]*\)\s*=>\s*{[^}]*res\.(?:send|json)/gi, name: 'Express route without auth middleware' },
    { pattern: /@(Get|Post|Put|Delete|Patch)\(\)\s*(?!@UseGuards)/gi, name: 'NestJS route without guards' },
    { pattern: /router\.(get|post|put|delete)\([^)]+function[^{]*{(?!.*authenticate)/gi, name: 'Router without authentication' },
    { pattern: /apiRoutes\.get.*auth:\s*false/gi, name: 'Route with auth: false' }
  ];

  let unauthRouteCount = 0;
  lines.forEach((line, index) => {
    // Check if line looks like API route definition
    const isRoute = /app\.(get|post|put|delete|patch)\(|router\.(get|post|put|delete|patch)\(|@(Get|Post|Put|Delete|Patch)\(/gi.test(line);

    if (isRoute) {
      // Check next few lines for authentication middleware
      const nextLines = lines.slice(index, Math.min(index + 5, lines.length)).join('\n');
      const hasAuth = /authenticate|requireAuth|isAuthenticated|@UseGuards|@Auth|protect|authorize/gi.test(nextLines);

      if (!hasAuth && unauthRouteCount < 3) {  // Limit reports to avoid spam
        unauthRouteCount++;
        const issue = createIssue(
          'api-without-authentication',
          SEVERITY.HIGH,
          'API Endpoint Without Authentication',
          'API route is defined without authentication middleware. Anyone can access this endpoint and potentially: read sensitive data, modify resources, trigger expensive operations, or exploit business logic vulnerabilities.',
          'Add authentication middleware to all routes that should be protected. Express: app.use(authenticate); or per-route: app.get("/api/data", authenticate, handler). Use JWT, OAuth, or session-based auth. Only public endpoints (login, signup, health checks) should be unauthenticated.',
          index + 1,
          'API Security'
        );
        issues.push(issue);
      }
    }
  });

  // Rule 56: Missing Rate Limiting - MEDIUM
  const hasRateLimiting = /rateLimit|rate-limit|express-rate-limit|slowDown|limiter/gi.test(code);
  const hasAPIRoutes = /app\.(get|post|put|delete|patch)|router\.(get|post|put|delete)/gi.test(code);

  if (hasAPIRoutes && !hasRateLimiting) {
    const issue = createIssue(
      'missing-rate-limiting',
      SEVERITY.MEDIUM,
      'Missing Rate Limiting',
      'API lacks rate limiting. Attackers can: brute force authentication, scrape all data via rapid requests, cause DoS by overwhelming the server, or abuse expensive operations. Public APIs are especially vulnerable.',
      'Implement rate limiting middleware. Express: use express-rate-limit. Set limits based on IP address: { windowMs: 15 * 60 * 1000, max: 100 }. Use stricter limits for auth endpoints. Consider using Redis for distributed rate limiting.',
      0,
      'API Security'
    );
    issues.push(issue);
  }

  // Rule 57: CORS Misconfiguration - MEDIUM
  const corsMisconfigurations = [
    { pattern: /Access-Control-Allow-Origin:\s*\*/gi, name: 'CORS wildcard origin' },
    { pattern: /cors\(\{\s*origin:\s*\*\s*\}\)/gi, name: 'CORS origin: *' },
    { pattern: /cors\(\{\s*origin:\s*true\s*\}\)/gi, name: 'CORS origin: true (reflects any)' },
    { pattern: /"Access-Control-Allow-Credentials":\s*"true".*"Access-Control-Allow-Origin":\s*"\*"/gi, name: 'CORS credentials with wildcard' }
  ];

  lines.forEach((line, index) => {
    corsMisconfigurations.forEach(({ pattern, name }) => {
      if (safeTest(pattern, line)) {
        const issue = createIssue(
          'cors-misconfiguration',
          SEVERITY.MEDIUM,
          'CORS Misconfiguration',
          `CORS is misconfigured (${name}). Allows any website to make requests to your API with user credentials. Attackers can create malicious websites that steal user data, perform actions on behalf of users, or extract sensitive information via cross-origin requests.`,
          'Use specific origins: cors({ origin: "https://yourapp.com" }). For multiple origins, use a whitelist. Never combine "Access-Control-Allow-Credentials: true" with "Access-Control-Allow-Origin: *". Validate origin dynamically if needed.',
          index + 1,
          'API Security'
        );
        issues.push(issue);
      }
    });
  });

  // Rule 58: Infrastructure as Code Secrets - HIGH
  const iacSecretPatterns = [
    { pattern: /password\s*=\s*["'][^"']+["']/gi, name: 'Hardcoded password in IaC' },
    { pattern: /secret\s*=\s*["'][^"']+["']/gi, name: 'Hardcoded secret in IaC' },
    { pattern: /token\s*=\s*["'][^"']+["']/gi, name: 'Hardcoded token in IaC' },
    { pattern: /master_password\s*=\s*["'][^"']+["']/gi, name: 'Database master password' },
    { pattern: /admin_password\s*=\s*["'][^"']+["']/gi, name: 'Admin password in IaC' }
  ];

  // Only check in IaC files (Terraform, CloudFormation, etc.)
  const isIaCFile = /terraform|\.tf|cloudformation|\.yaml|\.yml/gi.test(code) ||
                     /resource\s+"aws_|resource\s+"google_|resource\s+"azurerm_/gi.test(code);

  if (isIaCFile) {
    lines.forEach((line, index) => {
      iacSecretPatterns.forEach(({ pattern, name }) => {
        // Skip if it's using a variable reference
        if (safeTest(pattern, line) && !line.includes('var.') && !line.includes('${') &&
            !line.trim().startsWith('#') && !line.trim().startsWith('//')) {
          const issue = createIssue(
            'iac-hardcoded-secrets',
            SEVERITY.HIGH,
            'Secrets in Infrastructure as Code',
            `Infrastructure code contains hardcoded secrets (${name}). IaC files are committed to version control, making secrets accessible to anyone with repo access. Even if deleted later, secrets remain in git history forever.`,
            'Use variables and secret management. Terraform: use variables with sensitive = true, store values in .tfvars (gitignored) or environment variables. CloudFormation: use AWS Secrets Manager or Parameter Store. Never commit secrets to IaC files.',
            index + 1,
            'Infrastructure Security'
          );
          issues.push(issue);
        }
      });
    });
  }

  // Add all issues to results
  issues.forEach(issue => {
    if (issue.severity === 'CRITICAL') {
      results.critical.push(issue);
    } else if (issue.severity === 'HIGH') {
      results.high.push(issue);
    } else if (issue.severity === 'MEDIUM') {
      results.medium.push(issue);
    } else {
      results.low.push(issue);
    }
    results.allIssues.push(issue);
  });

  results.stats.rulesChecked += 13; // Rules 46-58
}

// Helper function to get beginner-friendly explanations
export function getBeginnerExplanation(issueId) {
  const explanations = {
    'hardcoded-api-key': {
      what: 'An API key is like a password that lets programs talk to services (like payment processors or AI models). Your code has this "password" written directly in it.',
      impact: 'If anyone sees your code (or if you accidentally share it on GitHub), they can steal your API key and use your account, potentially charging you thousands of dollars.',
      analogy: 'It\'s like writing your credit card number on a sticky note and posting it on social media. Anyone who sees it can use it.',
      fix: 'Store the API key in a secret place (environment variable) that\'s not in your code. Like: const key = process.env.API_KEY instead of const key = "sk_live_123".'
    },
    'sql-injection': {
      what: 'Your code builds database commands by gluing together strings. Hackers can type special characters to change what the command does.',
      impact: 'Hackers could read everyone\'s passwords, delete your entire database, or steal customer credit cards. This happened to Target in 2013 - 40 million credit cards stolen!',
      analogy: 'Imagine a form that says "Enter your name for badge" and someone writes "Alice" PLUS "and make me CEO". If you don\'t check, they become CEO!',
      fix: 'Use "parameterized queries" - let the database handle user input safely. Like: db.query("SELECT * WHERE id = ?", [userId]) instead of "SELECT * WHERE id = " + userId.'
    },
    'xss-vulnerability': {
      what: 'Your code puts user text directly into a webpage without cleaning it. Hackers can type JavaScript code instead of text.',
      impact: 'Malicious code runs in other users\' browsers, stealing their passwords, reading their emails, or posting as them.',
      analogy: 'Like letting someone write anything in your school newsletter. They could write "click here for free pizza" but actually steal everyone\'s lunch money.',
      fix: 'Use textContent instead of innerHTML, or clean the user input with a library like DOMPurify before displaying it.'
    },
    'env-in-git': {
      what: 'Your .env file (which contains all your secrets) is being tracked by git. Once it\'s in git, it stays in the history forever - even if you delete it later.',
      impact: 'Anyone who gets access to your GitHub repo can see all your API keys, passwords, and database credentials. Even if you make the repo private later, the secrets are already exposed in the git history.',
      analogy: 'It\'s like posting your house key location on social media, then deleting the post - but everyone already took a screenshot.',
      fix: 'Add .env to your .gitignore file right now. Then remove it from git history with: git rm --cached .env && git commit -m "Remove .env". Rotate ALL secrets in the file since they\'re compromised.'
    },
    'secrets-in-client-code': {
      what: 'Your React/Vue/Angular app is trying to use secret API keys. But client-side code is sent to users\' browsers - anyone can open DevTools and read all your secrets.',
      impact: 'Your API keys will be visible to anyone who uses your website. They can copy them and use your accounts, potentially charging you thousands of dollars.',
      analogy: 'Like printing your credit card number on your store\'s flyer that you hand to customers. Everyone who gets the flyer has your credit card.',
      fix: 'Keep secrets on your backend server. Create API endpoints that use the secrets internally. Your frontend calls YOUR API, and your API calls the external service with the secret. Only use environment variables prefixed with REACT_APP_ or NEXT_PUBLIC_ for non-secret public values.'
    },
    'debug-mode-production': {
      what: 'Your app is running in debug mode, which shows detailed error messages to users including file paths, database queries, and internal code.',
      impact: 'Hackers can trigger errors on purpose to learn about your system structure, file locations, database names, and libraries you use. This information helps them find other vulnerabilities.',
      analogy: 'Like leaving your house blueprints, safe combination hints, and security system manual on your front porch for anyone to read.',
      fix: 'Set NODE_ENV=production on your production server. Only enable debug mode in development: if (process.env.NODE_ENV !== "production") { app.set("debug", true); }'
    },
    'default-credentials': {
      what: 'Your code uses common default passwords like "admin/admin" or "root/password". These are the first thing hackers try.',
      impact: 'Attackers have automated bots that scan the entire internet trying "admin/admin" on every server. Your system will be hacked within hours of going online.',
      analogy: 'Like using "1234" as your phone PIN - everyone knows to try that first.',
      fix: 'Change ALL default credentials before deployment. Use strong, unique passwords: at least 16 characters, random mix of letters/numbers/symbols. Store them in environment variables, never in code.'
    },
    'insecure-file-upload': {
      what: 'Your file upload accepts any file type without checking. Users can upload executable files (.exe, .php) or huge files to crash your server.',
      impact: 'Attackers upload a malicious PHP or JSP file, then visit it in their browser to run code on your server. They can install backdoors, steal your database, or take complete control.',
      analogy: 'Like accepting mystery packages at your door without checking what\'s inside - someone could mail you a bomb.',
      fix: 'Whitelist allowed file types (only images: .jpg, .png). Check file size limits. Rename uploaded files so users can\'t control the name. Store files outside your web directory so they can\'t be executed.'
    },
    'insecure-cookie-settings': {
      what: 'Your authentication cookies don\'t have security flags (httpOnly, secure, sameSite). This makes them easy to steal.',
      impact: 'Without httpOnly: JavaScript malware can steal cookies. Without secure: cookies sent over HTTP can be intercepted. Without sameSite: your site is vulnerable to CSRF attacks where attackers trick users into making requests.',
      analogy: 'Like writing your password on a postcard (not an envelope) and mailing it - everyone who handles the mail can read it.',
      fix: 'Always set all three flags when creating cookies: res.cookie("token", value, { httpOnly: true, secure: true, sameSite: "strict" }); This prevents XSS, ensures HTTPS, and stops CSRF.'
    },
    'outdated-dependency': {
      what: 'Your package.json uses old versions of libraries. These old versions have known security holes (CVEs) that hackers actively exploit.',
      impact: 'The Equifax breach (2017) happened because of an outdated library. 147 million people\'s data was stolen. Hackers scan for old versions and exploit known vulnerabilities.',
      analogy: 'Like using a lock that everyone knows is broken. Thieves have the key published online - they just need to find your door.',
      fix: 'Update packages regularly: npm update packageName or npm install packageName@latest. Check for breaking changes in the changelog. Run npm audit to find vulnerabilities.'
    },
    'malicious-dependency': {
      what: 'You installed a package that\'s actually malware or a typo (typosquatting). It looks like a real package but with a slightly different name.',
      impact: 'The event-stream hack (2018) stole Bitcoin from developers by hiding malware in a popular package. Typosquatting attacks trick you into installing malicious code that steals credentials or injects backdoors.',
      analogy: 'Like ordering "Coca-Cola" but accidentally buying "Coca-C0la" (with a zero) from a sketchy store - looks similar but it\'s poison.',
      fix: 'Remove immediately: npm uninstall packageName. Double-check package names before installing. Use npm install --save-exact to lock versions. Check download counts and GitHub repos of packages.'
    },
    'unused-dependency': {
      what: 'Your package.json lists packages you don\'t actually use in your code. They still get installed and take up space.',
      impact: 'Unused packages increase your attack surface - more code means more potential vulnerabilities. They also slow down npm install and bloat your node_modules folder.',
      analogy: 'Like carrying a heavy backpack full of tools you never use - it just slows you down and makes you an easier target.',
      fix: 'Remove unused packages: npm uninstall packageName. Use tools like "depcheck" to find all unused dependencies across your project. Keep your dependencies clean and minimal.'
    },
    'missing-lock-file': {
      what: 'You don\'t have a package-lock.json file. Without it, npm installs different versions of packages each time, causing "works on my machine" bugs.',
      impact: 'Your teammate or CI server might install newer versions with bugs or security issues. Without lock files, builds aren\'t reproducible - what works today might break tomorrow.',
      analogy: 'Like a recipe that says "add some flour" instead of "add 2 cups flour" - everyone makes it differently and results vary.',
      fix: 'Generate lock file: Run npm install (creates package-lock.json). Commit it to git. In CI/CD, use npm ci instead of npm install to use the exact versions in the lock file.'
    },
    'potential-vulnerable-dependencies': {
      what: 'Your dependencies (including indirect ones) may have known security vulnerabilities. Even if you update your direct packages, their dependencies might be vulnerable.',
      impact: 'Transitive dependencies are the #1 source of vulnerabilities. You might not even know you\'re using a vulnerable package because it\'s installed automatically by something else.',
      analogy: 'Like hiring a contractor who hires subcontractors - you trust the contractor, but one of their subcontractors is a thief.',
      fix: 'Run npm audit to scan for vulnerabilities. Fix with npm audit fix. For breaking changes, use npm audit fix --force. Use Snyk or Dependabot for continuous monitoring.'
    },
    'vulnerabilities-detected': {
      what: 'npm audit found confirmed security vulnerabilities in your dependencies. These are real, documented security holes (CVEs) that hackers know about.',
      impact: 'Critical vulnerabilities can lead to remote code execution - hackers can take complete control of your server. High severity issues can leak data or crash your app.',
      analogy: 'Like a security guard telling you "there\'s a known burglar hiding in your house" - you need to act immediately, not ignore it.',
      fix: 'Fix immediately: Run npm audit fix to update packages. Review each CVE to understand the risk. Test your app after updates. For unfixable issues, consider alternative packages.'
    },
    'secrets-in-ci-logs': {
      what: 'Your CI/CD pipeline prints secrets to build logs using echo, console.log, or print. CI logs are often public (on GitHub) and stored forever.',
      impact: 'Anyone can read your build logs and steal your API keys, passwords, and deployment credentials. On public repos, this means the entire internet can see your secrets. CodeCov breach (2021) happened partly because credentials were in logs.',
      analogy: 'Like shouting your password out loud in a crowded room and recording it on video that stays online forever.',
      fix: 'Never echo or log secrets. To verify they exist, use: echo "Secret is set" instead of echo $SECRET. GitHub Actions automatically masks secrets UNLESS you explicitly print them. Remove all echo/console.log of ${{ secrets.* }}.'
    },
    'unverified-dependencies-ci': {
      what: 'Your CI pipeline uses "npm install" instead of "npm ci". This means it can install different package versions each time it runs.',
      impact: 'Between your last test and production deployment, a package can be compromised with malware (supply chain attack). Your build will install the malicious version and deploy it to production. event-stream attack (2018) happened this way.',
      analogy: 'Like testing a cake recipe with one batch of flour, but using a different (possibly poisoned) batch when making it for customers.',
      fix: 'Use npm ci instead of npm install in CI/CD. npm ci fails if package-lock.json doesn\'t match package.json, ensuring exact versions. For yarn: yarn install --frozen-lockfile. For pip: pip install --require-hashes.'
    },
    'missing-security-scans': {
      what: 'Your CI pipeline builds and deploys code without running any security scans (npm audit, Snyk, CodeQL, etc.). Vulnerabilities reach production undetected.',
      impact: 'You\'re deploying blind - no idea if you have security holes, leaked secrets, or vulnerable dependencies. Security scans are your last defense before production.',
      analogy: 'Like a factory shipping products without quality control - defective and dangerous items go straight to customers.',
      fix: 'Add security scanning to CI: 1) npm audit for dependencies, 2) Snyk/Dependabot for vulnerabilities, 3) Semgrep/CodeQL for code analysis, 4) TruffleHog for secrets. Fail builds on critical issues.'
    },
    'overly-permissive-ci-token': {
      what: 'Your CI workflow uses tokens with "write-all" or too many permissions. If a malicious dependency runs in CI, it can do anything to your repo.',
      impact: 'Compromised CI (malicious package, typosquatting) can modify your code, create releases, steal secrets, or take over your entire repository. GitHub Actions supply chain attacks exploit this.',
      analogy: 'Like giving a delivery person the keys to your house, safe, and car - they only need to drop off a package, not access everything.',
      fix: 'Use minimal permissions: only grant what\'s needed. Example: permissions: { contents: read, pull-requests: write }. Avoid write-all. Default GITHUB_TOKEN has limited permissions - only escalate when necessary.'
    },
    'secrets-exposed-to-forks': {
      what: 'Your workflow uses "pull_request_target" or exposes secrets to pull requests from forks. Attackers can create a PR with malicious code that steals your secrets.',
      impact: 'Anyone can fork your repo, add malicious code to steal secrets, and submit a PR. Your CI runs their code with your secrets. This is how many GitHub repos have been compromised.',
      analogy: 'Like letting strangers walk into your house (fork), and you hand them your safe keys (secrets) before checking who they are.',
      fix: 'Never use pull_request_target with secrets. Use pull_request instead (doesn\'t expose secrets to forks). If you must: 1) Checkout base branch, not PR branch, 2) Validate PR changes first, 3) Use separate workflow without secrets for PRs.'
    },
    'remote-script-execution': {
      what: 'Your CI downloads scripts from the internet and immediately runs them (curl | bash). If the source is compromised, malicious code runs with full access to your secrets.',
      impact: 'The source website can be hacked or hijacked. The script can steal your deployment credentials, inject backdoors, or compromise your entire infrastructure. This is a common supply chain attack.',
      analogy: 'Like a stranger saying "close your eyes and drink this" - you have no idea what you\'re consuming until it\'s too late.',
      fix: 'Never pipe downloads to bash. Download first, verify integrity (checksum), then execute: curl -o script.sh URL && sha256sum -c checksum && bash script.sh. Better: vendor scripts in your repo or use official Docker images.'
    },
    'blocking-operation': {
      what: 'Your code uses synchronous operations (like fs.readFileSync) that freeze the entire Node.js server while waiting for files/operations to complete.',
      impact: 'If reading a 100MB file takes 2 seconds, your ENTIRE server is frozen for 2 seconds - no other users can be served. One slow operation blocks thousands of requests.',
      analogy: 'Like a restaurant where the chef stops serving everyone else while waiting for one steak to cook. All customers wait, even those who ordered salads.',
      fix: 'Use async versions: fs.readFile() with async/await instead of fs.readFileSync(). This lets Node.js handle other requests while waiting: async function read() { const data = await fs.promises.readFile(path); }'
    },
    'memory-leak-event-listener': {
      what: 'Your component adds event listeners but never removes them. Each time the component mounts, new listeners are added, but old ones stay in memory forever.',
      impact: 'Memory usage grows constantly. After 100 page navigations, you have 100 copies of the same listener. Eventually the browser slows down or crashes. This is extremely common in SPAs.',
      analogy: 'Like subscribing to 100 newspapers but never cancelling - they pile up in your house until there\'s no room left.',
      fix: 'Remove listeners in cleanup. React: useEffect(() => { element.addEventListener("click", handler); return () => element.removeEventListener("click", handler); }, []). Vue: beforeDestroy hook.'
    },
    'memory-leak-interval': {
      what: 'Your code uses setInterval but never calls clearInterval. The interval keeps running even after the component unmounts, causing memory leaks and errors.',
      impact: 'Timers run forever, consuming memory and CPU. After navigating away from a page, the interval still tries to update state/DOM that no longer exists, causing crashes or errors.',
      analogy: 'Like setting a kitchen timer and leaving the house - it keeps ringing forever, wasting battery, even though you\'re not there to hear it.',
      fix: 'Always clear intervals in cleanup. React: useEffect(() => { const id = setInterval(() => {...}, 1000); return () => clearInterval(id); }, []). Save the interval ID and clear it on unmount.'
    },
    'n-plus-one-query': {
      what: 'Your code runs a database query inside a loop. If the loop runs 100 times, you make 100+ database calls instead of one. This is called the "N+1 problem".',
      impact: 'Catastrophic performance. Each database call takes ~10ms. 100 calls = 1 second. Users see loading spinners for ages. This bug crashed Instagram\'s feed in 2013 - pages took 30+ seconds to load.',
      analogy: 'Like going to the grocery store, buying one item, going home, then going back for the next item, 100 times. Instead of buying all 100 items in one trip.',
      fix: 'Load all data in ONE query. SQL: use JOIN. ORMs: User.find().populate("posts"). GraphQL: use DataLoader. Get everything at once, then loop through the data in memory.'
    },
    'api-calls-in-loop': {
      what: 'Your code makes HTTP requests inside a loop, calling the API once per item instead of batching. This is extremely slow and can hit rate limits.',
      impact: 'Each API call takes 100-500ms. If you loop 50 times, that\'s 5-25 seconds of waiting. You might also hit API rate limits and get blocked. Users see eternal loading spinners.',
      analogy: 'Like calling your friend 50 times to tell them 50 things, instead of calling once and saying all 50 things in one conversation.',
      fix: 'Batch requests with Promise.all(): const promises = items.map(item => fetch(url + item.id)); const results = await Promise.all(promises). Or use the API\'s batch endpoint if available.'
    },
    'redos-vulnerability': {
      what: 'Your regular expression uses nested quantifiers like (a+)+ which cause catastrophic backtracking. Attackers can send special strings that make the regex take exponentially longer to process.',
      impact: 'A malicious 50-character string can hang your server for minutes or hours, causing DoS. Stack Overflow was taken down by a ReDoS attack in 2016.',
      analogy: 'Like a maze that gets exponentially more complex with each step - eventually you\'re lost for hours trying every possible path.',
      fix: 'Avoid nested quantifiers: (a+)+ becomes a+. Use atomic groups (?>) if your regex engine supports it. Test with long strings. Use tools like safe-regex to detect ReDoS vulnerabilities.'
    },
    'large-bundle-import': {
      what: 'Your code imports entire libraries (like lodash or moment) instead of specific functions. This adds hundreds of KB to your JavaScript bundle.',
      impact: 'Your app takes much longer to download and parse. Users on slow 3G connections wait 10+ seconds for the page to load. Every user pays the cost, every time.',
      analogy: 'Like downloading the entire encyclopedia when you only need to look up one word - massive waste of time and bandwidth.',
      fix: 'Import only what you need. lodash: import debounce from "lodash/debounce" instead of import _ from "lodash". moment: switch to date-fns (2KB) or dayjs (2KB) instead of moment (67KB).'
    },
    'console-in-production': {
      what: 'Your code has console.log statements without production guards. These run in production, exposing debug info to users and causing minor performance overhead.',
      impact: 'Users can open DevTools and see your internal debugging messages - potentially revealing sensitive logic. Console statements also cause small performance hits in loops.',
      analogy: 'Like leaving sticky notes with private business notes all over your store for customers to read.',
      fix: 'Guard console logs: if (process.env.NODE_ENV !== "production") { console.log(...) }. Or configure your bundler to strip console.* in production builds automatically.'
    },
    'global-accumulation': {
      what: 'Your code stores growing data in global variables (window.items = [], window.items.push(...)). Over time, this consumes more and more memory.',
      impact: 'In long-running SPAs, memory grows until the browser slows down or crashes. Users have to refresh the page periodically to clear memory.',
      analogy: 'Like never emptying your trash can - eventually garbage overflows and your house becomes unlivable.',
      fix: 'Avoid global state for accumulating data. Use component state, implement pagination, or clean up old data. For large lists, use virtualization (react-window) to only render visible items.'
    },
    'exposed-cloud-credentials': {
      what: 'Your code or config files have hardcoded AWS/GCP/Azure credentials. These are like master keys to your entire cloud infrastructure.',
      impact: 'Anyone who sees your code can access your cloud account: delete databases, steal data, create expensive resources ($10,000+ bills), or hold your infrastructure for ransom. Capital One breach (2019) resulted from stolen AWS credentials.',
      analogy: 'Like posting your house keys, safe combination, and security system code on social media for everyone to see.',
      fix: 'Use environment variables: process.env.AWS_ACCESS_KEY_ID. Better: use IAM roles (AWS), Service Accounts (GCP), or Managed Identity (Azure) - no credentials needed in code at all!'
    },
    'overly-permissive-iam': {
      what: 'Your cloud IAM policy grants "Action: *" or "Resource: *" - unlimited permissions. Like giving someone a master key instead of specific room keys.',
      impact: 'If these credentials leak, attackers can do ANYTHING: delete production databases, shut down servers, steal all data, rack up $100,000+ cloud bills, or use your account for cryptocurrency mining.',
      analogy: 'Like hiring a janitor but giving them CEO privileges, building access, financial authority, and data deletion rights. They only need to empty trash!',
      fix: 'Grant minimum permissions. Instead of "Action: *", list specific actions: ["s3:GetObject", "s3:PutObject"]. Instead of "Resource: *", specify exact ARNs: "arn:aws:s3:::my-bucket/*".'
    },
    'unencrypted-cloud-storage': {
      what: 'Your S3 bucket, GCS bucket, or Azure blob storage is not encrypted. Data is stored in plaintext on cloud provider\'s disks.',
      impact: 'If someone gains physical access to storage hardware, or your cloud account is compromised, they can read all data. This violates GDPR, HIPAA, and PCI-DSS. Fines can be millions of dollars.',
      analogy: 'Like storing all your customer data on USB drives labeled "CONFIDENTIAL" but the drives aren\'t password protected - anyone who finds them can read everything.',
      fix: 'Enable encryption at rest. AWS S3: enable default encryption with AES-256 or KMS. GCP: enable Google-managed or customer-managed encryption. Azure: enable Storage Service Encryption (SSE).'
    },
    'overly-permissive-firewall': {
      what: 'Your firewall/security group allows inbound traffic from 0.0.0.0/0 (any IP on the internet) on all ports or sensitive ports like SSH.',
      impact: 'Exposes servers to the entire internet. Attackers can: brute force SSH passwords, exploit unpatched vulnerabilities, or find misconfigured services. WannaCry ransomware (2017) spread by scanning for exposed SMB ports.',
      analogy: 'Like leaving all doors and windows of your house unlocked 24/7, with a sign saying "come on in, everyone\'s welcome!"',
      fix: 'Restrict to specific IPs: use your office/home IP range. For SSH: use VPN or bastion host. Only allow 0.0.0.0/0 for public services (HTTP/HTTPS on ports 80/443). Use security group references instead of IP ranges.'
    },
    'container-running-as-root': {
      what: 'Your Docker container runs as root user (UID 0). If the container is compromised, attackers have superuser privileges.',
      impact: 'Attackers can: break out of container to host system, access other containers\' data, install rootkits, or achieve full system compromise. Many container escapes require root privileges.',
      analogy: 'Like running a restaurant where every employee has the owner\'s master key and safe code - one bad employee and everything is at risk.',
      fix: 'Run as non-root. Dockerfile: add "USER 1000" or create specific user. Kubernetes: set securityContext.runAsNonRoot: true and runAsUser: 1000. Remove "privileged: true".'
    },
    'exposed-docker-daemon': {
      what: 'Your Docker daemon is exposed on a network port (usually 2375) without authentication. Anyone can connect and control Docker.',
      impact: 'Remote attackers can: run privileged containers, mount host filesystem, extract secrets from all containers, or achieve complete host takeover. This is as bad as giving strangers SSH root access.',
      analogy: 'Like putting a control panel for your entire building (electricity, security, locks, safes) on the street with no password - anyone can walk up and control everything.',
      fix: 'NEVER expose Docker daemon to network. Use Unix socket (/var/run/docker.sock) with limited access. If remote access needed: use SSH tunneling or Docker over TLS (port 2376 with client certificates).'
    },
    'missing-resource-limits': {
      what: 'Your Kubernetes pods don\'t have CPU/memory limits set. One container can consume all available resources.',
      impact: 'Resource exhaustion attack: malicious or buggy container uses all CPU/memory, starving other containers. Legitimate services crash. Attackers can cause DoS by consuming infinite resources.',
      analogy: 'Like an all-you-can-eat buffet where one person can take ALL the food, leaving nothing for anyone else.',
      fix: 'Set resource requests and limits: resources: { requests: { memory: "128Mi", cpu: "100m" }, limits: { memory: "256Mi", cpu: "200m" }}. Prevents single container from consuming all resources.'
    },
    'insecure-kubernetes-config': {
      what: 'Your Kubernetes pod has dangerous settings like hostNetwork: true, privileged: true, or automountServiceAccountToken: true.',
      impact: 'Compromised pod can: access host network (bypass network policies), read service account tokens (access Kubernetes API), or escalate privileges. Attackers can spread from one pod to entire cluster.',
      analogy: 'Like giving a hotel guest access to the maintenance tunnels, master key, security camera footage, and employee-only areas - way more access than needed.',
      fix: 'Disable dangerous features: automountServiceAccountToken: false, hostNetwork: false, allowPrivilegeEscalation: false. Use Pod Security Standards to enforce policies cluster-wide.'
    },
    'missing-network-policies': {
      what: 'Your Kubernetes cluster has no NetworkPolicy resources. By default, all pods can talk to all other pods - zero network segmentation.',
      impact: 'If one microservice is compromised, attackers can: directly access databases, communicate with any other service, exfiltrate data, or lateral-move across the entire cluster. No defense in depth.',
      analogy: 'Like an apartment building where every unit\'s door is always unlocked and anyone can walk into any apartment - no boundaries or privacy.',
      fix: 'Implement NetworkPolicy resources. Start with default-deny, then whitelist required connections: deny all traffic by default, then allow web → API → database flows explicitly using pod labels.'
    },
    'api-without-authentication': {
      what: 'Your API endpoint has no authentication middleware. Anyone on the internet can access it without logging in or proving identity.',
      impact: 'Data breaches, unauthorized actions, resource abuse. Attackers can: steal user data, modify records, trigger expensive operations, or scrape your entire database. Many breaches start with unauthenticated APIs.',
      analogy: 'Like a bank vault with the door wide open and no security guards - anyone can walk in and take money.',
      fix: 'Add authentication middleware to all protected routes. Express: app.get("/api/data", authenticate, handler). Use JWT, OAuth, or session-based auth. Only public endpoints (login, health check) should be unauthenticated.'
    },
    'missing-rate-limiting': {
      what: 'Your API has no rate limiting. Users can make unlimited requests per second.',
      impact: 'Attackers can: brute force passwords (try millions of combinations), scrape all data via rapid requests, or overwhelm server causing DoS. Reddit, GitHub, Twitter all had issues before implementing rate limits.',
      analogy: 'Like a store with no purchase limits - one person can buy your entire inventory in 5 minutes, leaving nothing for anyone else.',
      fix: 'Use rate limiting middleware. Express: const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }); app.use(limiter). Set stricter limits for auth endpoints (5-10 attempts per minute).'
    },
    'cors-misconfiguration': {
      what: 'Your API allows CORS from any origin (Access-Control-Allow-Origin: *) while accepting credentials. Any website can make requests with user cookies.',
      impact: 'Attackers create malicious websites that make API requests on behalf of logged-in users: steal data, perform actions, transfer money, or change settings. Users don\'t even know it\'s happening.',
      analogy: 'Like giving a stranger permission to use your credit card and signature - they can make purchases pretending to be you.',
      fix: 'Use specific origins: cors({ origin: "https://yourapp.com", credentials: true }). NEVER combine credentials: true with origin: *. Validate origins against whitelist.'
    },
    'iac-hardcoded-secrets': {
      what: 'Your Terraform/CloudFormation files have hardcoded passwords or secrets. Infrastructure as Code files are committed to git, so secrets are in version control forever.',
      impact: 'Anyone with repo access sees secrets. Even if deleted, secrets remain in git history. Attackers can: access databases, modify infrastructure, or steal data. Uber breach (2016) started with AWS keys in GitHub.',
      analogy: 'Like writing all your passwords in a notebook and passing it around the office - everyone can read and copy them.',
      fix: 'Use variables with secret management. Terraform: define variables with sensitive = true, store values in .tfvars (gitignored). Use AWS Secrets Manager, HashiCorp Vault, or Azure Key Vault for secrets.'
    }
  };

  return explanations[issueId] || null;
}
