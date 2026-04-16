import { execFile } from "child_process";
import { promisify } from "util";
import { access } from "fs/promises";
import { join } from "path";
import { getHomeDir } from "../discovery/platform.js";

const execFileAsync = promisify(execFile);

// ── Types ──────────────────────────────────────────────────────────

export interface ModelBreakdown {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  totalTokens: number;
  source: string;
}

export interface DailyUsage {
  date: string;
  modelBreakdowns: ModelBreakdown[];
}

export interface AgentsViewData {
  available: boolean;
  binaryPath: string | null;
  dailyUsage: DailyUsage[];
  agents: string[];
}

// ── Binary resolution ──────────────────────────────────────────────

/**
 * Resolve the agentsview binary path.
 *
 * Strategy (mirrors tkmx-client):
 * 1. $AGENTSVIEW_BIN env var
 * 2. Hard-coded candidate paths
 * 3. `which agentsview` fallback
 */
export async function resolveAgentsViewBinary(): Promise<string | null> {
  // 1. Explicit env override
  const envBin = process.env.AGENTSVIEW_BIN;
  if (envBin && (await fileExists(envBin))) {
    return envBin;
  }

  // 2. Hard-coded candidates
  const home = getHomeDir();
  const candidates = [
    join(home, ".local", "bin", "agentsview"),
    "/opt/homebrew/bin/agentsview",
    "/usr/local/bin/agentsview",
    join(home, "bin", "agentsview"),
  ];

  for (const candidate of candidates) {
    if (await fileExists(candidate)) {
      return candidate;
    }
  }

  // 3. `which` fallback
  try {
    const { stdout } = await execFileAsync("which", ["agentsview"]);
    const path = stdout.trim();
    if (path) return path;
  } catch {
    // not found
  }

  return null;
}

// ── Data querying ──────────────────────────────────────────────────

/**
 * Query agentsview for daily usage breakdown.
 *
 * Runs: agentsview usage daily --json --breakdown --agent <agent> --since <date>
 */
async function queryAgentUsage(
  binaryPath: string,
  agent: string,
  since: string,
  opts?: { noSync?: boolean },
): Promise<DailyUsage[]> {
  const args = [
    "usage",
    "daily",
    "--json",
    "--breakdown",
    "--agent",
    agent,
    "--since",
    since,
  ];

  if (opts?.noSync) {
    args.push("--no-sync");
  }

  try {
    const { stdout } = await execFileAsync(binaryPath, args, {
      timeout: 30_000,
    });

    const parsed = JSON.parse(stdout);

    // Normalize the response into DailyUsage[]
    if (Array.isArray(parsed)) {
      return parsed.map(normalizeDailyUsage);
    }

    // Some versions may wrap in { data: [...] }
    if (parsed.data && Array.isArray(parsed.data)) {
      return parsed.data.map(normalizeDailyUsage);
    }

    return [];
  } catch {
    return [];
  }
}

function normalizeDailyUsage(raw: Record<string, unknown>): DailyUsage {
  const breakdowns = (
    (raw.modelBreakdowns ?? raw.model_breakdowns ?? []) as Record<
      string,
      unknown
    >[]
  ).map(normalizeModelBreakdown);

  return {
    date: String(raw.date ?? ""),
    modelBreakdowns: breakdowns,
  };
}

function normalizeModelBreakdown(
  raw: Record<string, unknown>,
): ModelBreakdown {
  const input = Number(raw.inputTokens ?? raw.input_tokens ?? 0);
  const output = Number(raw.outputTokens ?? raw.output_tokens ?? 0);
  const cacheCreation = Number(
    raw.cacheCreationTokens ?? raw.cache_creation_tokens ?? 0,
  );
  const cacheRead = Number(raw.cacheReadTokens ?? raw.cache_read_tokens ?? 0);

  return {
    model: String(raw.model ?? "unknown"),
    inputTokens: input,
    outputTokens: output,
    cacheCreationTokens: cacheCreation,
    cacheReadTokens: cacheRead,
    totalTokens: input + output + cacheCreation + cacheRead,
    source: String(raw.source ?? "unknown"),
  };
}

// ── Main entry point ───────────────────────────────────────────────

/**
 * Collect AgentsView data for all supported agents.
 *
 * Strategy: query "claude" first (triggers sync for all agents),
 * then "codex" with --no-sync to avoid redundant sync.
 */
export async function collectAgentsViewData(
  since?: string,
): Promise<AgentsViewData> {
  const binaryPath = await resolveAgentsViewBinary();

  if (!binaryPath) {
    return {
      available: false,
      binaryPath: null,
      dailyUsage: [],
      agents: [],
    };
  }

  const sinceDate = since ?? getDefaultSince();
  const agentsToQuery = ["claude", "codex"];
  const allUsage: DailyUsage[] = [];
  const foundAgents: string[] = [];

  for (let i = 0; i < agentsToQuery.length; i++) {
    const agent = agentsToQuery[i];
    const noSync = i > 0; // Only sync on first query
    const usage = await queryAgentUsage(binaryPath, agent, sinceDate, {
      noSync,
    });

    if (usage.length > 0) {
      foundAgents.push(agent);
      // Merge daily usage — combine entries for the same date
      for (const day of usage) {
        const existing = allUsage.find((d) => d.date === day.date);
        if (existing) {
          existing.modelBreakdowns.push(...day.modelBreakdowns);
        } else {
          allUsage.push({ ...day });
        }
      }
    }
  }

  // Sort by date ascending
  allUsage.sort((a, b) => a.date.localeCompare(b.date));

  return {
    available: true,
    binaryPath,
    dailyUsage: allUsage,
    agents: foundAgents,
  };
}

// ── Helpers ────────────────────────────────────────────────────────

function getDefaultSince(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().split("T")[0];
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

// ── Aggregate helpers (used by checks and trends) ──────────────────

export function getTotalTokens(data: AgentsViewData): number {
  return data.dailyUsage.reduce(
    (sum, day) =>
      sum +
      day.modelBreakdowns.reduce((s, m) => s + m.totalTokens, 0),
    0,
  );
}

export function getModelTokens(
  data: AgentsViewData,
  modelPattern: RegExp,
): number {
  return data.dailyUsage.reduce(
    (sum, day) =>
      sum +
      day.modelBreakdowns
        .filter((m) => modelPattern.test(m.model))
        .reduce((s, m) => s + m.totalTokens, 0),
    0,
  );
}

export function getCacheReadRatio(data: AgentsViewData): number {
  let totalInput = 0;
  let totalCacheRead = 0;

  for (const day of data.dailyUsage) {
    for (const m of day.modelBreakdowns) {
      totalInput += m.inputTokens;
      totalCacheRead += m.cacheReadTokens;
    }
  }

  if (totalInput + totalCacheRead === 0) return 0;
  return totalCacheRead / (totalInput + totalCacheRead);
}

export function getAvgDailyTokens(data: AgentsViewData): number {
  if (data.dailyUsage.length === 0) return 0;
  return getTotalTokens(data) / data.dailyUsage.length;
}
