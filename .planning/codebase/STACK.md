# Technology Stack

**Analysis Date:** 2026-03-25

## Languages

**Primary:**
- JavaScript (ES6+) - Client-side application logic and UI
- JSX - React component definitions in `src/App.jsx`, `src/main.jsx`

**Secondary:**
- None - No backend server or additional language layers

## Runtime

**Environment:**
- Node.js (version not explicitly specified, recommended 16+)

**Package Manager:**
- npm
- Lockfile: `package-lock.json` (tracked in .gitignore - generated at install)

## Frameworks

**Core:**
- React 18.2.0 - UI framework for component-based interface
- Vite 7.3.1 - Build tool and dev server

**Visualization:**
- Three.js 0.160.0 - 3D graphics library (used by Vanta background)
- Vanta 0.5.24 - Background animation effects, specifically `vanta.topology` module

**Export/Documents:**
- jsPDF 2.5.2 - PDF generation for exporting analysis results

**Build Support:**
- @vitejs/plugin-react 4.2.1 - React JSX transformation for Vite

## Key Dependencies

**Critical:**
- react - 18.2.0 - Core UI framework, required for component rendering
- vite - 7.3.1 - Build system and dev server (dev dependency)
- three - 0.160.0 - Required peer dependency for vanta.js animations
- vanta - 0.5.24 - Animated background visualization effect

**Infrastructure:**
- jspdf - 2.5.2 - Enables PDF export functionality for analysis reports
- @vitejs/plugin-react - 4.2.1 - Enables JSX transformation during builds

## Configuration

**Environment:**
- No environment variables required for core functionality
- .env files are gitignored but not required for operation
- Configuration constants defined in `src/config/constants.js`:
  - `MAX_FILE_SIZE`: 5MB limit for file uploads
  - `MAX_GITHUB_FILE_SIZE`: 1MB limit for GitHub file fetches
  - `MAX_REPO_FILES`: 50 files maximum for repository analysis
  - `GITHUB_TIMEOUT`: 15 second timeout for single file requests
  - `GITHUB_REPO_TIMEOUT`: 20 second timeout for repository requests

**Build:**
- `vite.config.js` - Single configuration file with React plugin enabled
- Module type: "module" (ES6 modules)
- Build output: `dist/` directory (generated, not committed)

## Platform Requirements

**Development:**
- Node.js 16+ (for npm and ES6+ support)
- Modern terminal with bash compatibility
- No database or backend server required

**Production:**
- Modern browser with ES6+ support (Chrome, Firefox, Safari, Edge - latest versions)
- No server-side deployment needed
- Static file hosting capability (any HTTP server can serve the `dist/` output)
- Web APIs required: File API, Fetch API, localStorage (if offline persistence added)

## Entry Points

- `index.html` - Static HTML entry point
- `src/main.jsx` - React application mount point
- `src/App.jsx` - Main application component (1175 lines, contains rule engine and UI)

---

*Stack analysis: 2026-03-25*
