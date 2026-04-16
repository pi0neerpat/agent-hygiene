import { defineConfig } from "tsup";
import { writeFileSync, readFileSync, chmodSync } from "fs";

export default defineConfig({
  entry: ["src/cli.ts", "src/index.ts"],
  format: ["esm"],
  target: "node18",
  platform: "node",
  clean: true,
  sourcemap: true,
  splitting: false,
  async onSuccess() {
    // Add shebang to CLI entry point
    const cliPath = "dist/cli.js";
    const content = readFileSync(cliPath, "utf-8");
    if (!content.startsWith("#!")) {
      writeFileSync(cliPath, "#!/usr/bin/env node\n" + content);
    }
    chmodSync(cliPath, 0o755);
  },
});
