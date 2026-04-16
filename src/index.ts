// Public API for programmatic usage
export { buildScanContext } from "./utils/context.js";
export { runChecks, ALL_CHECKS } from "./checks/index.js";
export { calculateScore } from "./scoring/index.js";
export { discoverAgents } from "./discovery/index.js";
export type {
  Check,
  CheckResult,
  FixResult,
  ScanContext,
  DiscoveredAgent,
  Tier,
  Category,
} from "./checks/types.js";
export type { OverallScore, CategoryScore } from "./scoring/index.js";
