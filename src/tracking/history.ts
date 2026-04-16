import { readFile, writeFile } from "fs/promises";
import { dirname } from "path";
import { getScoresPath, ensureDir } from "../utils/config.js";
import type { OverallScore } from "../scoring/index.js";

// ── Types ──────────────────────────────────────────────────────────

export interface ScoreRecord {
  timestamp: string;
  score: number;
  grade: string;
  projectDir: string;
  toolVersion: string;
  categories: {
    id: string;
    score: number;
    grade: string;
  }[];
  checks: {
    id: string;
    passed: boolean;
  }[];
}

// ── Constants ─────────────────────────────────────────────────────

const MAX_ENTRIES = 1000;

// ── Read / Write ──────────────────────────────────────────────────

/**
 * Append a scan result to the rolling JSONL history file.
 *
 * Each line is a self-contained JSON object. JSONL was chosen over a
 * single JSON array because it supports atomic appends without reading
 * the whole file — important when the file grows to hundreds of entries.
 */
export async function appendScoreRecord(
  score: OverallScore,
  projectDir: string,
  toolVersion: string,
): Promise<void> {
  const record: ScoreRecord = {
    timestamp: new Date().toISOString(),
    score: score.score,
    grade: score.grade,
    projectDir,
    toolVersion,
    categories: score.categories
      .filter((c) => c.total > 0)
      .map((c) => ({
        id: c.category.id,
        score: c.score,
        grade: c.grade,
      })),
    checks: score.categories.flatMap((c) =>
      c.checks.map((cr) => ({
        id: cr.check.id,
        passed: cr.result.passed,
      })),
    ),
  };

  const path = getScoresPath();
  await ensureDir(dirname(path));

  const line = JSON.stringify(record) + "\n";

  // Read existing content to enforce cap
  let existing = "";
  try {
    existing = await readFile(path, "utf-8");
  } catch {
    // file doesn't exist yet — fine
  }

  const lines = existing.trim() ? existing.trim().split("\n") : [];
  lines.push(line.trim());

  // Trim oldest entries if over cap
  while (lines.length > MAX_ENTRIES) {
    lines.shift();
  }

  await writeFile(path, lines.join("\n") + "\n", "utf-8");
}

/**
 * Read all score records from the history file.
 * Returns newest-last (chronological order).
 */
export async function readScoreHistory(): Promise<ScoreRecord[]> {
  const path = getScoresPath();
  let content: string;
  try {
    content = await readFile(path, "utf-8");
  } catch {
    return [];
  }

  const records: ScoreRecord[] = [];
  for (const line of content.trim().split("\n")) {
    if (!line.trim()) continue;
    try {
      records.push(JSON.parse(line) as ScoreRecord);
    } catch {
      // skip malformed lines
    }
  }
  return records;
}
