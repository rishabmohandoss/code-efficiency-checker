// Phase 3 Test File - Dependency & Supply Chain Security
// This file demonstrates dependency security issues

const express = require('express');
const request = require('request');  // Rule 41: Outdated and deprecated
const axios = require('axios');      // Rule 41: Very old version
const moment = require('moment');    // Rule 41: Old version, large bundle
const lodash = require('lodash');    // Rule 41: Old version

// NOTE: unused-package-one, unused-package-two, unused-package-three
// are declared in package.json but never imported here
// Rule 43: Unused Dependencies (will be detected)

const app = express();

// ==========================================
// RULE 41: OUTDATED DEPENDENCIES - HIGH
// ==========================================

/*
 * DETECTED OUTDATED PACKAGES IN PACKAGE.JSON:
 *
 * 1. express: ^3.21.2 (current is 4.x)
 *    - Old version with known vulnerabilities
 *    - Missing security patches
 *
 * 2. request: ^2.88.0
 *    - Deprecated package (archived)
 *    - Should use axios or node-fetch
 *
 * 3. moment: ^2.24.0
 *    - Old version, very large bundle size
 *    - Should use date-fns or dayjs
 *
 * 4. axios: ^0.18.0 (current is 1.x)
 *    - Very old version with security issues
 *
 * 5. react: ^15.6.2 (current is 18.x)
 *    - Ancient version, missing modern features
 *    - Known security vulnerabilities
 *
 * 6. next: ^9.5.5 (current is 13-14.x)
 *    - Old version with security issues
 *
 * 7. some-random-package: ^0.1.2 (pre-1.0)
 *    - Unstable version (0.x)
 *    - May be unmaintained
 *
 * 8. old-package: ^0.5.0 (pre-1.0)
 *    - Unstable, potentially abandoned
 *
 * Expected: 7-8 HIGH severity issues for outdated dependencies
 */

// ==========================================
// RULE 42: MALICIOUS DEPENDENCIES - CRITICAL
// ==========================================

/*
 * DETECTED MALICIOUS/TYPOSQUATTING PACKAGES:
 *
 * 1. event-stream: 3.3.6 - CRITICAL
 *    - This specific version contained Bitcoin-stealing malware
 *    - Compromised in 2018, affected many projects
 *    - https://blog.npmjs.org/post/180565383195/details-about-the-event-stream-incident
 *
 * 2. crossenv: ^7.0.3 - CRITICAL
 *    - Typosquatting attack on "cross-env"
 *    - Designed to steal credentials
 *
 * 3. babelcli: ^6.26.0 - HIGH
 *    - Typosquatting attack on "babel-cli"
 *    - May contain malware
 *
 * Expected: 2-3 CRITICAL issues for malicious packages
 */

// Example of using the compromised package (DON'T DO THIS!)
// const es = require('event-stream');

// ==========================================
// RULE 43: UNUSED DEPENDENCIES - LOW
// ==========================================

/*
 * UNUSED PACKAGES (declared but never imported):
 *
 * 1. unused-package-one: ^1.0.0
 * 2. unused-package-two: ^2.0.0
 * 3. unused-package-three: ^3.0.0
 *
 * These packages are in package.json but never required/imported
 * They increase attack surface and bundle size
 *
 * Expected: 3 LOW severity issues for unused dependencies
 */

// ==========================================
// RULE 44: MISSING LOCK FILE - MEDIUM
// ==========================================

/*
 * If package-lock.json doesn't exist:
 * - Different versions may be installed on different machines
 * - "Works on my machine" bugs
 * - Non-deterministic builds
 * - Security risk from version drift
 *
 * This rule checks if:
 * 1. package.json exists but no lock file mentioned
 * 2. npm install is used without --frozen-lockfile
 *
 * Expected: 1 MEDIUM severity issue if no lock file detected
 */

// Example npm install command (triggers detection if no lock file)
// npm install

// ==========================================
// RULE 45: VULNERABLE DEPENDENCIES - HIGH
// ==========================================

/*
 * Example npm audit output (paste this in code to trigger detection):
 *
 * found 15 vulnerabilities (8 moderate, 7 high)
 * run `npm audit fix` to fix them
 *
 * OR:
 *
 * 8 high severity vulnerabilities
 * 3 critical vulnerabilities
 *
 * The detector looks for patterns like:
 * - "X vulnerabilities"
 * - "high severity"
 * - "critical severity"
 * - "CVE-"
 *
 * Expected: 1 CRITICAL or HIGH issue if audit output detected
 */

// Simulated npm audit output in comments:
// npm audit report
//
// found 15 vulnerabilities (8 moderate, 5 high, 2 critical)
//
// Some of these vulnerabilities require manual review.
// Run `npm audit fix` to fix them.

// ==========================================
// CORRECT EXAMPLES (Should NOT trigger)
// ==========================================

// Using modern, maintained packages:
// const express = require('express');  // Latest version
// const axios = require('axios');      // Version 1.x
// const dayjs = require('dayjs');      // Instead of moment

// Proper package.json with updated versions:
/*
{
  "dependencies": {
    "express": "^4.18.2",
    "axios": "^1.4.0",
    "lodash": "^4.17.21",
    "react": "^18.2.0",
    "next": "^13.4.0"
  }
}
*/

// Using lock files:
// package-lock.json exists (committed to git)
// npm ci (instead of npm install in CI/CD)

// Running security audits:
// npm audit
// npm audit fix
// npm audit fix --force

app.get('/', (req, res) => {
  const now = moment().format('YYYY-MM-DD');
  res.send(`Hello World! Today is ${now}`);
});

// Using old request library (deprecated)
request('https://api.example.com', (error, response, body) => {
  if (!error && response.statusCode === 200) {
    console.log(body);
  }
});

// Using old axios version
axios.get('https://api.example.com')
  .then(response => console.log(response.data))
  .catch(error => console.error(error));

app.listen(3000);

// ==========================================
// EXPECTED DETECTIONS:
// ==========================================
//
// CRITICAL: 2-3 issues
//   - event-stream malicious package
//   - crossenv typosquatting
//   - (possibly) vulnerabilities detected from audit output
//
// HIGH: 7-9 issues
//   - express outdated
//   - request outdated/deprecated
//   - axios outdated
//   - moment outdated
//   - react outdated
//   - next outdated
//   - lodash outdated (possibly)
//   - some-random-package (0.x version)
//   - old-package (0.x version)
//
// MEDIUM: 1 issue
//   - Missing lock file (if package-lock.json not found)
//
// LOW: 3 issues
//   - unused-package-one
//   - unused-package-two
//   - unused-package-three
//
// TOTAL: 13-16 issues expected
// ==========================================
