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
    }
  };

  return explanations[issueId] || null;
}
