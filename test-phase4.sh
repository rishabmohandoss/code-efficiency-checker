#!/bin/bash
# Phase 4 Test File - CI/CD Security Issues
# Typical CI/CD build script with security vulnerabilities

set -e

echo "=========================================="
echo "Starting CI/CD Pipeline Build"
echo "=========================================="

# ==========================================
# RULE 63: SECRETS IN CI/CD LOGS - CRITICAL
# ==========================================

echo "========== SECRETS IN LOGS =========="

# CRITICAL: Echoing secrets directly
echo "API Key: $API_KEY"
echo "Database Password: $DB_PASSWORD"
echo "Stripe Secret: $STRIPE_SECRET_KEY"
echo $JWT_SECRET
echo $AWS_ACCESS_KEY_ID

# CRITICAL: Logging all environment variables (includes secrets)
env | grep SECRET
printenv | grep TOKEN

# HIGH: Secrets in command arguments
curl -H "Authorization: Bearer $DEPLOY_TOKEN" https://api.example.com/deploy
git clone https://$GITHUB_TOKEN@github.com/user/private-repo.git
wget https://api.service.com/data?key=$API_KEY

# Correct examples (should NOT trigger):
# echo "Checking if API key is set..."
# if [ -z "$API_KEY" ]; then
#   echo "Error: API_KEY not set"
# else
#   echo "API_KEY is configured"  # Safe - doesn't show value
# fi

# ==========================================
# RULE 64: UNVERIFIED DEPENDENCIES - HIGH
# ==========================================

echo "========== INSTALLING DEPENDENCIES =========="

# HIGH: npm install instead of npm ci
npm install

# HIGH: yarn without frozen lockfile
yarn install

# HIGH: pip without hash verification
pip install requests
pip install flask

# HIGH: Downloading and executing remote scripts
echo "Installing tools..."
curl -fsSL https://get.docker.com | bash
wget -qO- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
curl https://install.meteor.com/ | sh

# Installing from untrusted sources
npm install -g some-random-package

# Correct examples (should NOT trigger):
# npm ci
# yarn install --frozen-lockfile
# pip install -r requirements.txt --require-hashes
# curl -o install.sh https://example.com/install.sh
# sha256sum -c install.sh.checksum
# bash install.sh

# ==========================================
# RULE 65: MISSING SECURITY SCANS - MEDIUM
# ==========================================

echo "========== BUILDING APPLICATION =========="

# Build application
npm run build
yarn build

# Compile code
make build
mvn package
gradle build

# Create Docker image
docker build -t myapp:latest .

# Deploy to production
echo "Deploying to production..."
kubectl apply -f deployment.yml
./deploy-to-prod.sh

# NOTICE: No security scans ran!
# Missing: npm audit, snyk test, trivy, semgrep, etc.

# Correct example (should NOT trigger):
# echo "Running security scans..."
# npm audit
# npm audit fix
# snyk test
# trivy image myapp:latest
# semgrep --config=auto

# ==========================================
# RULE 66: OVERLY PERMISSIVE TOKENS - HIGH
# ==========================================

# This is harder to detect in shell scripts, but the detector
# looks for patterns in GitHub Actions YAML files

# Using multiple different tokens:
export GITHUB_TOKEN=$GITHUB_TOKEN
export AWS_TOKEN=$AWS_TOKEN
export AZURE_TOKEN=$AZURE_TOKEN
export HEROKU_TOKEN=$HEROKU_TOKEN
export VERCEL_TOKEN=$VERCEL_TOKEN

# ==========================================
# ADDITIONAL VULNERABLE PATTERNS
# ==========================================

# Storing secrets in files
echo $API_KEY > /tmp/api-key.txt
echo $DB_PASSWORD >> build.log

# Broadcasting secrets over network
curl -X POST -d "api_key=$API_KEY" https://logging-service.com/log

# ==========================================
# SUMMARY
# ==========================================

echo "=========================================="
echo "Build completed!"
echo "=========================================="

# ==========================================
# EXPECTED DETECTIONS:
# ==========================================
#
# CRITICAL: 6-8 issues
#   - Multiple echo statements with secrets ($API_KEY, $DB_PASSWORD, etc.)
#   - env | grep SECRET (exposes secrets to logs)
#   - printenv | grep TOKEN (exposes tokens to logs)
#
# HIGH: 7-10 issues
#   - Secrets in curl command arguments
#   - Secrets in git clone URL
#   - Secrets in wget URL
#   - npm install (without ci)
#   - yarn install (without frozen-lockfile)
#   - pip install (without verification)
#   - Multiple curl | bash instances
#   - wget | bash instances
#   - curl | sh instances
#
# MEDIUM: 1 issue
#   - Missing security scans (has build/deploy but no npm audit, snyk, etc.)
#
# TOTAL: 14-19 issues expected
# ==========================================

# Notes:
# - In real CI/CD, these commands would expose secrets in:
#   1. Build logs (publicly accessible on GitHub Actions)
#   2. System logs (auditd, syslog)
#   3. Process lists (ps aux shows command args)
#   4. Shell history
#
# - Consequences:
#   1. API keys leaked → unauthorized charges, data theft
#   2. Deploy tokens leaked → unauthorized deployments
#   3. Database credentials leaked → data breaches
#   4. Source code leaked (via git clone tokens)
#
# - Real-world examples:
#   1. CodeCov breach (2021): Bash uploader compromised
#   2. Travis CI leak (2021): Thousands of secrets exposed in logs
#   3. CircleCI incident (2023): Environment variables leaked
