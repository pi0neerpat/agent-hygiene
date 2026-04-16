import type { Check, ScanContext, CheckResult } from "../types.js";
import { safeReadFile } from "../../utils/fs.js";

export const promptCachingCheck: Check = {
  id: "prompt-caching",
  name: "Prompt caching",
  technique: 3,
  tier: "advisory",
  category: "cost",
  agents: ["claude-code", "cursor", "github-copilot"],
  estimatedSavings: "Cached prompts cost 90% less per token",
  weight: 6,
  impact: "med",
  fixPrompt: `Enable prompt caching in my LLM API calls. Update to the latest Anthropic SDK which supports automatic prompt caching. For manual control, add cache_control breakpoints to system messages that are reused across calls — cached input tokens cost 90% less. Structure prompts so that the static system prompt comes first (and gets cached), with dynamic user content appended after the cache boundary.`,

  async run(ctx: ScanContext): Promise<CheckResult> {
    // Check if the project uses the Anthropic SDK
    const codeFiles = await ctx.glob(
      "**/*.{ts,js,py,tsx,jsx,mjs}",
    );
    const filesToScan = codeFiles.slice(0, 30);

    let usesAnthropicSdk = false;
    let hasCacheControl = false;

    for (const file of filesToScan) {
      const content = await safeReadFile(file);
      if (!content) continue;

      if (/(?:anthropic|@anthropic-ai\/sdk)/i.test(content)) {
        usesAnthropicSdk = true;
      }

      if (/cache.?control|cache_control|ephemeral/i.test(content)) {
        hasCacheControl = true;
      }
    }

    if (!usesAnthropicSdk) {
      return {
        passed: false,
        message: "Verify prompt caching is enabled in your LLM calls",
        details:
          "The Anthropic SDK supports automatic prompt caching — cached input tokens cost 90% less. Ensure you're using a recent SDK version and structuring system prompts for cache efficiency.",
      };
    }

    if (hasCacheControl) {
      return {
        passed: true,
        message: "Prompt caching appears to be configured",
      };
    }

    return {
      passed: false,
      message: "Anthropic SDK detected but no explicit cache control found",
      details:
        "Recent SDK versions support automatic caching. Ensure you're on the latest version. For manual control, add cache_control breakpoints to system messages that are reused across calls.",
    };
  },
};
