import type { AgentsViewData } from "../tracking/agentsview.js";

export type Tier = "auto" | "session" | "semi-auto" | "advisory";
export type Category = "context" | "cost" | "habits" | "structure";
export type Impact = "high" | "med" | "low";

export interface CheckResult {
  passed: boolean;
  message: string;
  details?: string;
  /** 0-1 confidence for semi-auto checks */
  confidence?: number;
}

export interface FixResult {
  applied: boolean;
  message: string;
  filesModified?: string[];
  backedUpFiles?: string[];
}

export interface ScanContext {
  /** Discovered agents keyed by agent id */
  agents: Map<string, DiscoveredAgent>;
  /** Home directory */
  homeDir: string;
  /** Current working directory (project root) */
  projectDir: string;
  /** Environment variables */
  env: Record<string, string | undefined>;
  /** Shell profile contents (combined .zshrc, .bashrc, etc.) */
  shellProfileContents: string;
  /** Read a file relative to project or absolute, returns null if missing */
  readFile(path: string): Promise<string | null>;
  /** Check if a path exists */
  exists(path: string): Promise<boolean>;
  /** List files in a directory */
  listDir(path: string): Promise<string[]>;
  /** Glob files from project root */
  glob(pattern: string): Promise<string[]>;
  /** AgentsView usage data (null if agentsview not installed) */
  agentsViewData: AgentsViewData | null;
}

export interface DiscoveredAgent {
  id: string;
  name: string;
  status: "installed" | "configured" | "not-found";
  configPaths: string[];
  /** Paths that actually exist on disk */
  foundPaths: string[];
}

export interface Check {
  id: string;
  name: string;
  technique: number;
  tier: Tier;
  category: Category;
  agents: string[];
  estimatedSavings: string;
  weight: number;
  /** Impact tier for fix menu ordering (high/med/low). */
  impact: Impact;
  run(ctx: ScanContext): Promise<CheckResult>;
  /** Automated fixer — mutates files/settings directly. */
  fix?(ctx: ScanContext): Promise<FixResult>;
  /** Agent prompt for manual fixes — shown to user to copy into their AI agent.
   *  Can be a static string or a function that receives scan context and check
   *  result for dynamic, context-aware prompts. */
  fixPrompt?: string | ((ctx: ScanContext, result: CheckResult) => string);
}
