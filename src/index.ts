// Public API for programmatic usage
export { buildScanContext } from "./utils/context.js";
export { runChecks, ALL_CHECKS } from "./checks/index.js";
export { calculateScore } from "./scoring/index.js";
export { discoverAgents } from "./discovery/index.js";
export {
  collectAgentsViewData,
  resolveAgentsViewBinary,
} from "./tracking/agentsview.js";
export {
  saveSnapshot,
  loadSnapshot,
  listSnapshots,
  compareSnapshots,
} from "./tracking/snapshots.js";
export { analyzeTrends } from "./tracking/trends.js";
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
export type {
  AgentsViewData,
  ModelBreakdown,
  DailyUsage,
} from "./tracking/agentsview.js";
export type {
  Snapshot,
  SnapshotComparison,
  CostBaseline,
} from "./tracking/snapshots.js";
export type { TrendAnalysis, Recommendation } from "./tracking/trends.js";
