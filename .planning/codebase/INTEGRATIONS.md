# External Integrations

**Analysis Date:** 2026-03-25

## APIs & External Services

**GitHub API:**
- GitHub REST API v3 - Used for fetching public repository content
  - SDK/Client: Native `fetch()` API
  - Auth: None required (unauthenticated access to public repos)
  - Rate limit: 60 requests/hour (unauthenticated)
  - Base URL: `https://api.github.com/repos/`

**Related Functions:**
- `parseGitHubUrl()` (line 171) - Extracts owner, repo, branch, and file path from GitHub URLs
- `fetchGitHubFile()` (line 182) - Fetches single file content via GitHub API
- `fetchGitHubRepoTree()` (line 197) - Fetches repository tree (all files recursively)
- `analyzeGitHubRepository()` (line 223) - Orchestrates repository-wide analysis with progress tracking

## Data Storage

**Databases:**
- None - Purely client-side application, no backend persistence

**File Storage:**
- Local file upload via HTML File API (browser-native)
- No cloud storage integration
- Files processed entirely in-memory, not persisted

**Caching:**
- Browser localStorage available for future use (not currently implemented)
- No server-side caching

## Authentication & Identity

**Auth Provider:**
- None - Public GitHub API access only, no authentication configured
- GitHub URL support limited to public repositories accessible without credentials
- No login/signup mechanism

## Monitoring & Observability

**Error Tracking:**
- None configured - Errors logged to browser console only
- Error messages displayed to user in UI

**Logs:**
- Console logging via `console.log()`, `console.error()` (development only)
- No centralized logging service

## CI/CD & Deployment

**Hosting:**
- Static file hosting only (any HTTP server or CDN)
- GitHub Pages compatible
- Vercel, Netlify, or similar static hosts supported

**CI Pipeline:**
- None currently configured
- Vite build process: `npm run build` generates `dist/` output
- Test framework available but tests not automated

## Environment Configuration

**Required env vars:**
- None required for basic operation
- GitHub integration does not require API keys (uses unauthenticated access)

**Secrets location:**
- Not applicable - No secrets or credentials needed
- `.env`, `.env.local` files are gitignored (empty structure prepared but not needed)

## Webhooks & Callbacks

**Incoming:**
- None - Client-side only application, no server endpoints

**Outgoing:**
- None - No callbacks to external services
- GitHub API calls are one-way fetches (no webhooks)

## Limitations & Constraints

**GitHub Integration Constraints:**
- Public repositories only (no private repo support)
- 60 requests/hour rate limit per IP
- 1MB maximum file size for individual files (`MAX_GITHUB_FILE_SIZE`)
- 5MB maximum file size for direct uploads (`MAX_FILE_SIZE`)
- Maximum 50 files analyzed per repository scan (`MAX_REPO_FILES`)
- 15-second timeout for individual file fetches (`GITHUB_TIMEOUT`)
- 20-second timeout for repository tree requests (`GITHUB_REPO_TIMEOUT`)

**Network Requirements:**
- Fetch API support (all modern browsers)
- CORS handling - GitHub API returns proper CORS headers for browser requests
- AbortController support for timeout implementation

---

*Integration audit: 2026-03-25*
