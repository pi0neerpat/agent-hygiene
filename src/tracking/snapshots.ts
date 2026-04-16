import { mkdir, readFile, writeFile, readdir } from "fs/promises";
import { join } from "path";
import { getHomeDir } from "../discovery/platform.js";
import type { OverallScore, CategoryScore } from "../scoring/index.js";
import type { AgentsViewData } from "./agentsview.js";
import { getTotalTokens, getModelTokens, getCacheReadRatio } from "./agentsview.js";

// ── Types ──────────────────────────────────────────────────────────

export interface Snapshot {
  name: string;
  timestamp: string;
  score: number;
  grade: string;
  categories: {
    id: string;
    name: string;
    score: number;
    grade: string;
  }[];
  /** Cost baseline from AgentsView (null if not available) */
  costBaseline: CostBaseline | null;
}

export interface CostBaseline {
  periodDays: number;
  totalTokens: number;
  opusTokens: number;
  sonnetTokens: number;
  haikuTokens: number;
  cacheReadRatio: number;
  avgDailyTokens: number;
}

export interface SnapshotComparison {
  before: Snapshot;
  after: Snapshot;
  scoreDelta: number;
  categoryDeltas: {
    name: string;
    before: number;
    after: number;
    delta: number;
  }[];
  costDelta: CostDelta | null;
}

export interface CostDelta {
  tokensDelta: number;
  tokensDeltaPct: number;
  avgDailyDelta: number;
  cacheRatioDelta: number;
  opusPctBefore: number;
  opusPctAfter: number;
}

// ── Snapshot directory ─────────────────────────────────────────────

function getSnapshotDir(): string {
  return join(getHomeDir(), ".agent-hygiene", "snapshots");
}

async function ensureSnapshotDir(): Promise<string> {
  const dir = getSnapshotDir();
  await mkdir(dir, { recursive: true });
  return dir;
}

// ── Save ───────────────────────────────────────────────────────────

export async function saveSnapshot(
  name: string,
  score: OverallScore,
  agentsViewData: AgentsViewData | null,
): Promise<string> {
  const dir = await ensureSnapshotDir();

  const snapshot: Snapshot = {
    name,
    timestamp: new Date().toISOString(),
    score: score.score,
    grade: score.grade,
    categories: score.categories.map((c) => ({
      id: c.category.id,
      name: c.category.name,
      score: c.score,
      grade: c.grade,
    })),
    costBaseline: agentsViewData?.available
      ? buildCostBaseline(agentsViewData)
      : null,
  };

  const filename = `${sanitizeFilename(name)}.json`;
  const filepath = join(dir, filename);
  await writeFile(filepath, JSON.stringify(snapshot, null, 2), "utf-8");
  return filepath;
}

function buildCostBaseline(data: AgentsViewData): CostBaseline {
  const totalTokens = getTotalTokens(data);
  return {
    periodDays: data.dailyUsage.length,
    totalTokens,
    opusTokens: getModelTokens(data, /opus/i),
    sonnetTokens: getModelTokens(data, /sonnet/i),
    haikuTokens: getModelTokens(data, /haiku/i),
    cacheReadRatio: getCacheReadRatio(data),
    avgDailyTokens:
      data.dailyUsage.length > 0
        ? totalTokens / data.dailyUsage.length
        : 0,
  };
}

// ── Load ───────────────────────────────────────────────────────────

export async function loadSnapshot(name: string): Promise<Snapshot | null> {
  const dir = getSnapshotDir();
  const filename = `${sanitizeFilename(name)}.json`;
  try {
    const content = await readFile(join(dir, filename), "utf-8");
    return JSON.parse(content) as Snapshot;
  } catch {
    return null;
  }
}

export async function listSnapshots(): Promise<string[]> {
  const dir = getSnapshotDir();
  try {
    const files = await readdir(dir);
    return files
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(/\.json$/, ""))
      .sort();
  } catch {
    return [];
  }
}

// ── Compare ────────────────────────────────────────────────────────

export function compareSnapshots(
  before: Snapshot,
  after: Snapshot,
): SnapshotComparison {
  const categoryDeltas = after.categories.map((afterCat) => {
    const beforeCat = before.categories.find((c) => c.id === afterCat.id);
    return {
      name: afterCat.name,
      before: beforeCat?.score ?? 0,
      after: afterCat.score,
      delta: afterCat.score - (beforeCat?.score ?? 0),
    };
  });

  let costDelta: CostDelta | null = null;
  if (before.costBaseline && after.costBaseline) {
    const bCost = before.costBaseline;
    const aCost = after.costBaseline;

    const bTotal = bCost.totalTokens || 1; // avoid divide by zero
    costDelta = {
      tokensDelta: aCost.totalTokens - bCost.totalTokens,
      tokensDeltaPct:
        ((aCost.totalTokens - bCost.totalTokens) / bTotal) * 100,
      avgDailyDelta: aCost.avgDailyTokens - bCost.avgDailyTokens,
      cacheRatioDelta: aCost.cacheReadRatio - bCost.cacheReadRatio,
      opusPctBefore:
        bTotal > 0 ? (bCost.opusTokens / bTotal) * 100 : 0,
      opusPctAfter:
        aCost.totalTokens > 0
          ? (aCost.opusTokens / aCost.totalTokens) * 100
          : 0,
    };
  }

  return {
    before,
    after,
    scoreDelta: after.score - before.score,
    categoryDeltas,
    costDelta,
  };
}

// ── Helpers ────────────────────────────────────────────────────────

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
}
