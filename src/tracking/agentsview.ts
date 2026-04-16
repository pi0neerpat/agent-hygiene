import { execFile } from "child_process";
import { constants } from "fs";
import { promisify } from "util";
import { access, stat } from "fs/promises";
import { delimiter, join } from "path";
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
  /**
   * Optional signals parsed from agentsview output if present.
   * Sprint 3.5 additions — undefined when the binary doesn't surface them.
   * Checks must handle `undefined` gracefully.
   */
  sessionCount?: number;
  maxSessionTokens?: number;
  messageCount?: number;
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
  if (envBin && (await isExecutableFile(envBin))) {
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
    if (await isExecutableFile(candidate)) {
      return candidate;
    }
  }

  // 3. PATH fallback. Avoid spawning `which`; PATH resolution is simple and
  // keeping it in-process avoids trusting another executable from PATH.
  const pathBin = await resolveFromPath("agentsview");
  if (pathBin) return pathBin;

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

    // Normalize the response into DailyUsage[].
    //
    // AgentsView's `usage daily --json --breakdown` output shape (observed):
    //     { "daily": [ { date, modelBreakdowns, ... } ], "totals": {...} }
    //
    // Older / alternative shapes we also accept defensively:
    //     [ ... ]              — bare array
    //     { "data": [...] }    — generic wrapper
    if (Array.isArray(parsed)) {
      return parsed.map(normalizeDailyUsage);
    }

    if (parsed.daily && Array.isArray(parsed.daily)) {
      return parsed.daily.map(normalizeDailyUsage);
    }

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

  // Optional Sprint 3.5 signals — left undefined if the binary doesn't
  // surface them. We check both camelCase and snake_case variants.
  const sessionCount = optionalNumber(
    raw.sessionCount ?? raw.session_count ?? raw.sessions,
  );
  const maxSessionTokens = optionalNumber(
    raw.maxSessionTokens ?? raw.max_session_tokens ?? raw.peak_session_tokens,
  );
  const messageCount = optionalNumber(
    raw.messageCount ?? raw.message_count ?? raw.messages,
  );

  const out: DailyUsage = {
    date: String(raw.date ?? ""),
    modelBreakdowns: breakdowns,
  };
  if (sessionCount !== undefined) out.sessionCount = sessionCount;
  if (maxSessionTokens !== undefined) out.maxSessionTokens = maxSessionTokens;
  if (messageCount !== undefined) out.messageCount = messageCount;
  return out;
}

function optionalNumber(v: unknown): number | undefined {
  if (v === undefined || v === null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
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

  // AgentsView emits the model under `modelName`; older/alternate sources
  // may use `model` or snake_case. Accept all three.
  const modelName = String(
    raw.modelName ?? raw.model_name ?? raw.model ?? "unknown",
  );

  return {
    model: modelName,
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
          // Optional signals: sum counts, take max of peak session size.
          existing.sessionCount = sumOptional(
            existing.sessionCount,
            day.sessionCount,
          );
          existing.messageCount = sumOptional(
            existing.messageCount,
            day.messageCount,
          );
          existing.maxSessionTokens = maxOptional(
            existing.maxSessionTokens,
            day.maxSessionTokens,
          );
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

async function isExecutableFile(path: string): Promise<boolean> {
  try {
    const info = await stat(path);
    if (!info.isFile()) return false;
    await access(
      path,
      process.platform === "win32" ? constants.F_OK : constants.X_OK,
    );
    return true;
  } catch {
    return false;
  }
}

async function resolveFromPath(command: string): Promise<string | null> {
  const pathEnv = process.env.PATH;
  if (!pathEnv) return null;

  const extensions =
    process.platform === "win32"
      ? (process.env.PATHEXT ?? ".EXE;.CMD;.BAT;.COM")
          .split(";")
          .filter(Boolean)
      : [""];

  for (const dir of pathEnv.split(delimiter)) {
    if (!dir) continue;
    for (const ext of extensions) {
      const candidate = join(dir, `${command}${ext}`);
      if (await isExecutableFile(candidate)) {
        return candidate;
      }
    }
  }

  return null;
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

/**
 * Peak single-session token size across the period, if the data source
 * provides it. Returns undefined when `maxSessionTokens` is missing from
 * every daily record.
 */
export function getMaxSessionTokens(
  data: AgentsViewData,
): number | undefined {
  let peak: number | undefined;
  for (const day of data.dailyUsage) {
    if (day.maxSessionTokens === undefined) continue;
    peak =
      peak === undefined
        ? day.maxSessionTokens
        : Math.max(peak, day.maxSessionTokens);
  }
  return peak;
}

/**
 * Total number of sessions across the period, if available.
 * Returns undefined if no daily record carries a session count.
 */
export function getTotalSessionCount(
  data: AgentsViewData,
): number | undefined {
  let total: number | undefined;
  for (const day of data.dailyUsage) {
    if (day.sessionCount === undefined) continue;
    total = (total ?? 0) + day.sessionCount;
  }
  return total;
}

/**
 * Output-to-input token ratio for a given model pattern. Low ratios
 * suggest lookup/read-heavy work that cheaper models can handle; high
 * ratios suggest generative/reasoning work that may justify Opus.
 * Returns undefined if the model has zero input tokens.
 */
export function getOutputInputRatio(
  data: AgentsViewData,
  modelPattern: RegExp,
): number | undefined {
  let input = 0;
  let output = 0;
  for (const day of data.dailyUsage) {
    for (const m of day.modelBreakdowns) {
      if (!modelPattern.test(m.model)) continue;
      // Count cache reads as "input" for ratio purposes — they're still
      // prompt tokens the model has to process.
      input += m.inputTokens + m.cacheReadTokens + m.cacheCreationTokens;
      output += m.outputTokens;
    }
  }
  if (input === 0) return undefined;
  return output / input;
}

// ── Internal optional-number helpers ───────────────────────────────

function sumOptional(
  a: number | undefined,
  b: number | undefined,
): number | undefined {
  if (a === undefined && b === undefined) return undefined;
  return (a ?? 0) + (b ?? 0);
}

function maxOptional(
  a: number | undefined,
  b: number | undefined,
): number | undefined {
  if (a === undefined && b === undefined) return undefined;
  if (a === undefined) return b;
  if (b === undefined) return a;
  return Math.max(a, b);
}
