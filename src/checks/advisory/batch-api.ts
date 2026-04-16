import type { Check, ScanContext, CheckResult } from "../types.js";
import { safeReadFile } from "../../utils/fs.js";

export const batchApiCheck: Check = {
  id: "batch-api",
  name: "Batch API for async workloads",
  technique: 2,
  tier: "advisory",
  category: "cost",
  agents: ["claude-code", "cursor", "github-copilot"],
  estimatedSavings: "Batch API is 50% cheaper than real-time API",
  weight: 5,
  impact: "med",
  fixPrompt: `The Anthropic Batch API processes requests asynchronously at 50% lower cost. Scan the codebase for LLM API calls that process multiple items without needing real-time responses — look for Promise.all with messages.create, for-loops over API calls, or bulk processing patterns. Migrate eligible calls to the Batch API.`,

  async run(ctx: ScanContext): Promise<CheckResult> {
    // Look for indicators of batch-like workloads
    const codeFiles = await ctx.glob(
      "**/*.{ts,js,py,tsx,jsx,mjs}",
    );
    const filesToScan = codeFiles.slice(0, 30);

    let hasBatchPatterns = false;
    for (const file of filesToScan) {
      const content = await safeReadFile(file);
      if (!content) continue;

      // Look for patterns suggesting batch processing with LLMs
      const batchIndicators = [
        /for\s+.*\bin\b.*:[\s\S]{0,200}(?:messages\.create|completions\.create)/i,
        /Promise\.all\s*\(\s*\[[\s\S]{0,500}(?:messages\.create|completions\.create)/i,
        /\.map\s*\(\s*(?:async\s*)?\([^)]*\)\s*=>[\s\S]{0,200}(?:messages\.create|completions\.create)/i,
        /batch|bulk|parallel.*(?:api|request|call)/i,
      ];

      if (batchIndicators.some((p) => p.test(content))) {
        hasBatchPatterns = true;
        break;
      }
    }

    if (hasBatchPatterns) {
      return {
        passed: false,
        message: "Batch-like API patterns detected — consider Batch API",
        details:
          "The Anthropic Batch API processes requests asynchronously at 50% lower cost. If these calls don't need real-time responses, switch to batching.",
      };
    }

    return {
      passed: false,
      message: "Consider the Batch API for any async LLM workloads",
      details:
        "If you have workloads that don't need immediate responses (data processing, evaluation, content generation), the Batch API offers 50% cost savings.",
    };
  },
};
