import type { AgentsViewData, DailyUsage } from "./agentsview.js";
import {
  getTotalTokens,
  getModelTokens,
  getCacheReadRatio,
} from "./agentsview.js";

// ── Types ──────────────────────────────────────────────────────────

export interface TrendAnalysis {
  period: { start: string; end: string; days: number };
  totalTokens: number;
  avgDailyTokens: number;
  modelBreakdown: ModelShare[];
  cacheEfficiency: {
    ratio: number;
    trend: "improving" | "declining" | "stable";
  };
  dailyTrend: "increasing" | "decreasing" | "stable";
  recommendations: Recommendation[];
}

export interface ModelShare {
  model: string;
  tokens: number;
  pct: number;
  estimatedCost: number;
}

export interface Recommendation {
  priority: "high" | "medium" | "low";
  message: string;
  estimatedSavings: string;
}

// ── Pricing (approximate $/1M tokens) ──────────────────────────────

const PRICING: Record<string, { input: number; output: number }> = {
  opus: { input: 15, output: 75 },
  sonnet: { input: 3, output: 15 },
  haiku: { input: 0.25, output: 1.25 },
};

function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const key = /opus/i.test(model)
    ? "opus"
    : /haiku/i.test(model)
      ? "haiku"
      : "sonnet";
  const price = PRICING[key];
  return (
    (inputTokens / 1_000_000) * price.input +
    (outputTokens / 1_000_000) * price.output
  );
}

// ── Main analysis ──────────────────────────────────────────────────

export function analyzeTrends(data: AgentsViewData): TrendAnalysis {
  const usage = data.dailyUsage;
  const totalTokens = getTotalTokens(data);
  const avgDaily = usage.length > 0 ? totalTokens / usage.length : 0;

  // Model breakdown
  const modelMap = new Map<
    string,
    { tokens: number; input: number; output: number }
  >();
  for (const day of usage) {
    for (const m of day.modelBreakdowns) {
      const key = normalizeModelName(m.model);
      const entry = modelMap.get(key) ?? {
        tokens: 0,
        input: 0,
        output: 0,
      };
      entry.tokens += m.totalTokens;
      entry.input += m.inputTokens + m.cacheCreationTokens;
      entry.output += m.outputTokens;
      modelMap.set(key, entry);
    }
  }

  const modelBreakdown: ModelShare[] = [...modelMap.entries()]
    .map(([model, { tokens, input, output }]) => ({
      model,
      tokens,
      pct: totalTokens > 0 ? (tokens / totalTokens) * 100 : 0,
      estimatedCost: estimateCost(model, input, output),
    }))
    .sort((a, b) => b.tokens - a.tokens);

  // Cache efficiency trend
  const cacheRatio = getCacheReadRatio(data);
  const cacheTrend = analyzeCacheTrend(usage);

  // Daily token trend
  const dailyTrend = analyzeDailyTrend(usage);

  // Generate recommendations
  const recommendations = generateRecommendations(
    data,
    modelBreakdown,
    cacheRatio,
    avgDaily,
  );

  return {
    period: {
      start: usage[0]?.date ?? "N/A",
      end: usage[usage.length - 1]?.date ?? "N/A",
      days: usage.length,
    },
    totalTokens,
    avgDailyTokens: avgDaily,
    modelBreakdown,
    cacheEfficiency: { ratio: cacheRatio, trend: cacheTrend },
    dailyTrend,
    recommendations,
  };
}

// ── Trend helpers ──────────────────────────────────────────────────

function analyzeDailyTrend(
  usage: DailyUsage[],
): "increasing" | "decreasing" | "stable" {
  if (usage.length < 4) return "stable";

  const mid = Math.floor(usage.length / 2);
  const firstHalf = usage.slice(0, mid);
  const secondHalf = usage.slice(mid);

  const firstAvg = avgDayTokens(firstHalf);
  const secondAvg = avgDayTokens(secondHalf);

  if (secondAvg > firstAvg * 1.2) return "increasing";
  if (secondAvg < firstAvg * 0.8) return "decreasing";
  return "stable";
}

function analyzeCacheTrend(
  usage: DailyUsage[],
): "improving" | "declining" | "stable" {
  if (usage.length < 4) return "stable";

  const mid = Math.floor(usage.length / 2);
  const firstRatio = halfCacheRatio(usage.slice(0, mid));
  const secondRatio = halfCacheRatio(usage.slice(mid));

  if (secondRatio > firstRatio + 0.05) return "improving";
  if (secondRatio < firstRatio - 0.05) return "declining";
  return "stable";
}

function avgDayTokens(days: DailyUsage[]): number {
  if (days.length === 0) return 0;
  const total = days.reduce(
    (sum, d) =>
      sum + d.modelBreakdowns.reduce((s, m) => s + m.totalTokens, 0),
    0,
  );
  return total / days.length;
}

function halfCacheRatio(days: DailyUsage[]): number {
  let input = 0;
  let cacheRead = 0;
  for (const d of days) {
    for (const m of d.modelBreakdowns) {
      input += m.inputTokens;
      cacheRead += m.cacheReadTokens;
    }
  }
  if (input + cacheRead === 0) return 0;
  return cacheRead / (input + cacheRead);
}

function normalizeModelName(model: string): string {
  if (/opus/i.test(model)) return "Opus";
  if (/haiku/i.test(model)) return "Haiku";
  if (/sonnet/i.test(model)) return "Sonnet";
  return model;
}

// ── Recommendations ────────────────────────────────────────────────

function generateRecommendations(
  data: AgentsViewData,
  modelBreakdown: ModelShare[],
  cacheRatio: number,
  avgDaily: number,
): Recommendation[] {
  const recs: Recommendation[] = [];

  // Opus overuse recommendation
  const opusShare = modelBreakdown.find((m) => m.model === "Opus");
  const sonnetShare = modelBreakdown.find((m) => m.model === "Sonnet");
  if (opusShare && opusShare.pct > 40) {
    const potentialSaving = opusShare.estimatedCost * 0.6;
    recs.push({
      priority: "high",
      message: `${opusShare.pct.toFixed(0)}% of tokens on Opus ($${opusShare.estimatedCost.toFixed(2)} est.) — switching routine tasks to Sonnet could save ~$${potentialSaving.toFixed(2)}`,
      estimatedSavings: `~$${potentialSaving.toFixed(2)}/period`,
    });
  }

  // Subagent model recommendation
  const haikuShare = modelBreakdown.find((m) => m.model === "Haiku");
  if ((!haikuShare || haikuShare.pct < 5) && opusShare && opusShare.pct > 50) {
    recs.push({
      priority: "high",
      message:
        "No significant Haiku usage detected — set CLAUDE_CODE_SUBAGENT_MODEL=claude-haiku-4-5-20251001 to route exploration to cheaper models",
      estimatedSavings: "~60-80% on subagent tasks",
    });
  }

  // Cache efficiency recommendation
  if (cacheRatio < 0.15) {
    recs.push({
      priority: "medium",
      message: `Cache hit rate is only ${(cacheRatio * 100).toFixed(0)}% — ensure you're on the latest Anthropic SDK for auto-caching`,
      estimatedSavings: "Up to 90% reduction on input token costs",
    });
  }

  // Session length recommendation
  if (avgDaily > 500_000) {
    recs.push({
      priority: "medium",
      message: `Daily token usage averages ${formatTokens(avgDaily)} — use /clear between tasks to avoid compounding context costs`,
      estimatedSavings: "20-40% reduction in daily token burn",
    });
  }

  // Total cost summary
  const totalCost = modelBreakdown.reduce(
    (sum, m) => sum + m.estimatedCost,
    0,
  );
  if (totalCost > 0 && recs.length > 0) {
    const totalSaving = recs.length > 0 ? totalCost * 0.3 : 0;
    recs.push({
      priority: "low",
      message: `Estimated total spend: $${totalCost.toFixed(2)} over ${data.dailyUsage.length} days. Implementing above recommendations could save ~$${totalSaving.toFixed(2)}`,
      estimatedSavings: `~$${totalSaving.toFixed(2)}/period`,
    });
  }

  return recs;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}
