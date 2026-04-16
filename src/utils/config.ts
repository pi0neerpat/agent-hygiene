import { mkdir } from "fs/promises";
import { join } from "path";
import { getHomeDir } from "../discovery/platform.js";

// ── Config directory paths ────────────────────────────────────────

const ROOT_DIR_NAME = ".agent-hygiene";

/** ~/.agent-hygiene/ */
export function getAgentHygieneDir(): string {
  return join(getHomeDir(), ROOT_DIR_NAME);
}

/** ~/.agent-hygiene/snapshots/ */
export function getSnapshotsDir(): string {
  return join(getAgentHygieneDir(), "snapshots");
}

/** ~/.agent-hygiene/scores.jsonl */
export function getScoresPath(): string {
  return join(getAgentHygieneDir(), "scores.jsonl");
}

// ── Utilities ─────────────────────────────────────────────────────

/** Ensure a directory exists (mkdir -p equivalent). */
export async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}
