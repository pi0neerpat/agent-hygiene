import { defineConfig } from "tsup";
import { writeFileSync, readFileSync, chmodSync } from "fs";
import { builtinModules } from "module";

// Node built-in modules must stay external (they're always available at
// runtime). Everything else (chalk, commander, ora, etc.) gets bundled
// so the CLI works as a self-contained binary — critical for npm link
// and npx in Yarn PnP repos where there's no node_modules/.
const nodeBuiltins = builtinModules.flatMap((m) => [m, `node:${m}`]);

export default defineConfig({
  entry: ["src/cli.ts", "src/index.ts"],
  format: ["esm"],
  target: "node18",
  platform: "node",
  clean: true,
  sourcemap: true,
  splitting: false,
  noExternal: [/.*/],
  external: nodeBuiltins,
  // Commander and ora are CJS packages that use require() for Node builtins.
  // When tsup bundles them into ESM, its __require shim can't resolve builtins.
  // Inject a real require() via createRequire so CJS interop works.
  banner: {
    js: 'import { createRequire as __cr } from "module"; const require = __cr(import.meta.url);',
  },
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
