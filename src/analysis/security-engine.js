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
      if (pattern.test(line)) {
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
      if (pattern.test(line) && !line.includes('process.env') && !line.includes('example')) {
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
      if (pattern.test(line)) {
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
      if (pattern.test(line)) {
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
      if (pattern.test(line)) {
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
      if (pattern.test(line)) {
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
        if (pattern.test(line)) {
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
      if (pattern.test(line)) {
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
      if (pattern.test(line)) {
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
      if (pattern.test(line) && !line.includes('path.resolve') && !line.includes('path.join')) {
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
      if (pattern.test(line)) {
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
      if (pattern.test(line)) {
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
      if (pattern.test(line)) {
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
      if (pattern.test(line) && !context.includes('user') && !context.includes('auth') && !context.includes('owner')) {
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
        if (pattern.test(line)) {
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
      if (pattern.test(line)) {
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
        if (pattern.test(line)) {
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
      if (pattern.test(line)) {
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
        if (pattern.test(line)) {
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
        if (pattern.test(line)) {
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
      if (pattern.test(line)) {
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
      if (pattern.test(line)) {
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
      if (pattern.test(line) && (line.toLowerCase().includes('password') || line.toLowerCase().includes('pass'))) {
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
      if (pattern.test(line) && !line.includes('example')) {
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
      if (pattern.test(line)) {
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
      if (pattern.test(line) && !line.includes('||') && !line.includes('??') && !line.includes('if')) {
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
      if (pattern.test(line)) {
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
      if (pattern.test(line) && !line.includes('if') && !line.includes('//')) {
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
      if (pattern.test(line)) {
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
        if (pattern.test(line)) {
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
        if (pattern.test(line)) {
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

  const hasFileUpload = fileUploadPatterns.some(pattern => pattern.test(code));

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
      if (pattern.test(line)) {
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
      if (pattern.test(line)) {
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
      if (oldVersionPattern.test(line) && !line.includes('//')) {
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
      if (pattern.test(line)) {
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
    }
  };

  return explanations[issueId] || null;
}
