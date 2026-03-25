// ═══════════════════════════════════════════════════════════════════════════════
// RULE REGISTRY — Central export for all analysis rules
// ═══════════════════════════════════════════════════════════════════════════════

import { performanceRules } from './performanceRules.js';
import { aiSlopRules } from './aiSlopRules.js';

// Combined rule set: 18 performance rules + 7 AI slop detection rules = 25 total
export const RULES = [
  ...performanceRules,
  ...aiSlopRules
];

// Export individual rule sets for targeted analysis
export { performanceRules, aiSlopRules };
