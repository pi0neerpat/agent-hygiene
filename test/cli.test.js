import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const CLI_PATH = fileURLToPath(new URL("../dist/cli.js", import.meta.url));

function runCli(args) {
  return spawnSync(process.execPath, [CLI_PATH, ...args], {
    encoding: "utf-8",
  });
}

test("scan rejects non-integer min score before scanning", () => {
  const result = runCli(["scan", "--no-session", "--json", "--min-score", "abc"]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /--min-score must be an integer/);
  assert.equal(result.stdout, "");
});

test("scan rejects out-of-range min score", () => {
  const result = runCli(["scan", "--no-session", "--json", "--min-score", "101"]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /--min-score must be between 0 and 100/);
  assert.equal(result.stdout, "");
});

test("track rejects invalid calendar dates before collecting data", () => {
  const result = runCli(["track", "--since", "2026-02-31"]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /--since must be a valid calendar date/);
  assert.equal(result.stdout, "");
});

test("history rejects non-integer limit", () => {
  const result = runCli(["history", "--limit", "nope"]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /--limit must be an integer/);
  assert.equal(result.stdout, "");
});
