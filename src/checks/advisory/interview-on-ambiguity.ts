import type { Check, ScanContext, CheckResult } from "../types.js";
import { join } from "path";

const INTERVIEW_HINTS = [
  /\bAskUserQuestion\b/,
  /\binterview\s+(?:me|the\s+user)\b/i,
  /\bask\s+(?:me|the\s+user)\s+(?:question|to\s+clarif|for\s+clarif|before|when|if)/i,
  /\bclarif(?:y|ying|ication)[^.]*(?:before|question|ambig|unclear)/i,
  /\b(?:when|if)[^.]*(?:ambig|unclear|unsure)[^.]*\bask\b/i,
];

function mentionsInterviewGuidance(content: string): boolean {
  return INTERVIEW_HINTS.some((p) => p.test(content));
}

export const interviewOnAmbiguityCheck: Check = {
  id: "interview-on-ambiguity",
  name: "Interview on ambiguity",
  technique: 21,
  tier: "advisory",
  category: "habits",
  agents: ["claude-code", "codex"],
  estimatedSavings: "Upfront clarification prevents expensive rework cycles",
  weight: 5,
  impact: "med",
  fixPrompt: `I ran agent-hygiene and it flagged that there's no guidance in my rules files telling you to ask clarifying questions when project direction is unclear. Without that guardrail you end up guessing, and the work often needs to be redone — a short interview up front is much cheaper than rework.\n\nBefore you make changes, please ask me:\n1. Should this guidance live in CLAUDE.md, AGENTS.md, or both?\n2. What's my preferred way to ask clarifying questions — the AskUserQuestion tool, a plain numbered list, or something else?\n\nOnce I've answered, please add a short rule to the chosen file(s), placed under an existing workflow/conventions section if one exists. Example wording:\n"When the task is ambiguous or the desired outcome isn't obvious, interview me with the AskUserQuestion tool (or a short numbered list) before writing code. Getting clarity up front is much cheaper than rework."`,

  async run(ctx: ScanContext): Promise<CheckResult> {
    const files = [
      join(ctx.projectDir, "CLAUDE.md"),
      join(ctx.projectDir, "AGENTS.md"),
      join(ctx.homeDir, ".claude", "CLAUDE.md"),
    ];

    for (const path of files) {
      const content = await ctx.readFile(path);
      if (content && mentionsInterviewGuidance(content)) {
        return {
          passed: true,
          message: `Interview-on-ambiguity guidance found in ${path}`,
        };
      }
    }

    return {
      passed: false,
      message:
        "No interview-on-ambiguity guidance found in CLAUDE.md or AGENTS.md",
      details:
        "When requirements are unclear, agents often guess — producing code that needs rework. A short rule telling the agent to ask clarifying questions (e.g. via the AskUserQuestion tool) before writing code prevents wasted cycles.",
    };
  },
};
