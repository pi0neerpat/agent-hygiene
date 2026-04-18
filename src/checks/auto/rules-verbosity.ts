import type { Check, ScanContext, CheckResult } from "../types.js";
import { join } from "path";

const MIN_LINES = 20;
const SENTENCE_LEN_THRESHOLD = 22;
const BULLET_DENSITY_THRESHOLD = 0.4;
const BLANK_DENSITY_THRESHOLD = 0.3;

const FILLER_PHRASES = [
  /\bin order to\b/gi,
  /\bit is important to note\b/gi,
  /\bplease be aware\b/gi,
  /\bmake sure to\b/gi,
  /\bit should be noted\b/gi,
  /\bneedless to say\b/gi,
];

interface VerbosityScore {
  avgSentenceLen: number;
  bulletDensity: number;
  blankDensity: number;
  fillerCount: number;
  flagged: string[];
}

function scoreVerbosity(content: string): VerbosityScore {
  const lines = content.split("\n");
  const nonBlank = lines.filter((l) => l.trim().length > 0);
  const blank = lines.length - nonBlank.length;

  const bullets = nonBlank.filter((l) =>
    /^\s*(?:[-*]|#{1,6})\s+/.test(l),
  ).length;

  // Sentences: split on . ! ? followed by whitespace or end. Strip code
  // fences so code blocks don't skew the average.
  const withoutCode = content.replace(/```[\s\S]*?```/g, "");
  const sentences = withoutCode
    .split(/[.!?]+\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const totalWords = sentences.reduce(
    (sum, s) => sum + s.split(/\s+/).filter(Boolean).length,
    0,
  );
  const avgSentenceLen =
    sentences.length > 0 ? totalWords / sentences.length : 0;

  const bulletDensity =
    nonBlank.length > 0 ? bullets / nonBlank.length : 0;
  const blankDensity = lines.length > 0 ? blank / lines.length : 0;

  let fillerCount = 0;
  for (const re of FILLER_PHRASES) {
    const matches = content.match(re);
    if (matches) fillerCount += matches.length;
  }

  const flagged: string[] = [];
  if (avgSentenceLen > SENTENCE_LEN_THRESHOLD) {
    flagged.push(`avg sentence ${avgSentenceLen.toFixed(1)} words (>22)`);
  }
  if (bulletDensity > BULLET_DENSITY_THRESHOLD) {
    flagged.push(
      `bullet density ${(bulletDensity * 100).toFixed(0)}% (>40%)`,
    );
  }
  if (blankDensity > BLANK_DENSITY_THRESHOLD) {
    flagged.push(
      `blank-line density ${(blankDensity * 100).toFixed(0)}% (>30%)`,
    );
  }
  if (fillerCount > 0) {
    flagged.push(`${fillerCount} filler phrase(s)`);
  }

  return { avgSentenceLen, bulletDensity, blankDensity, fillerCount, flagged };
}

export const rulesVerbosityCheck: Check = {
  id: "rules-verbosity",
  name: "CLAUDE.md / AGENTS.md verbosity",
  technique: 15,
  tier: "auto",
  category: "context",
  agents: ["claude-code", "codex"],
  estimatedSavings: "Tighter rules = fewer tokens per message",
  weight: 5,
  impact: "med",
  fixPrompt: (_ctx, result) =>
    `I ran agent-hygiene and it flagged: ${result.message}.\n\n` +
    `Rules files are injected into every message, so verbosity compounds into real token cost.\n\n` +
    `Before you make changes, please ask me:\n` +
    `1. Should you aim for plain prose, or retain structure where it's load-bearing?\n` +
    `2. Are there any sections that must stay as bullets (e.g. command lists, enumerations)?\n\n` +
    `Once I've answered, please tighten the flagged file(s):\n` +
    `- Replace bulleted lists with a single sentence when the bullets are a flat enumeration of short items.\n` +
    `- Delete redundant structure (headers over one-line sections, separators between tiny blocks).\n` +
    `- Shorten sentences: cut filler ("in order to" → "to"), prefer active voice, drop qualifiers.\n` +
    `- Keep structure only where it genuinely aids scanning of parallel items.`,

  async run(ctx: ScanContext): Promise<CheckResult> {
    const files = [
      join(ctx.projectDir, "CLAUDE.md"),
      join(ctx.projectDir, "AGENTS.md"),
    ];

    const issues: string[] = [];

    for (const path of files) {
      const content = await ctx.readFile(path);
      if (!content) continue;

      const lines = content.split("\n").length;
      if (lines < MIN_LINES) continue;

      const score = scoreVerbosity(content);
      // Fail if two or more signals trip
      if (score.flagged.length >= 2) {
        issues.push(`${path}: ${score.flagged.join(", ")}`);
      }
    }

    if (issues.length === 0) {
      return {
        passed: true,
        message: "Rules files are concise",
      };
    }

    return {
      passed: false,
      message: `Verbose rules detected — ${issues.join("; ")}`,
      details:
        "Short concise prose beats bullet-list scaffolding. Rules files are injected into every message, so verbosity compounds into real token cost.",
    };
  },
};
