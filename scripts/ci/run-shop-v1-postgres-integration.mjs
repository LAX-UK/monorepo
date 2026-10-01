#!/usr/bin/env node
/**
 * Runs shop-api Postgres integration tests with URLs set.
 * Fails if Vitest reports any skipped tests (integration suite must execute).
 */
import { spawnSync } from "node:child_process";

const env = {
  ...process.env,
  SHOP_V1_INTEGRATION_REQUIRED: "true",
  CI: process.env.CI ?? "true",
};

const result = spawnSync(
  "pnpm",
  [
    "--filter",
    "@auction/shop-api",
    "exec",
    "vitest",
    "run",
    "src/infrastructure",
    "--reporter=verbose",
  ],
  {
    env,
    stdio: "pipe",
    encoding: "utf8",
  },
);

const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
process.stdout.write(result.stdout ?? "");
process.stderr.write(result.stderr ?? "");

const skippedMatch = output.match(/(\d+) skipped/);
const skipped = skippedMatch ? Number(skippedMatch[1]) : 0;
if (skipped > 0) {
  console.error(`Shop V1 integration gate failed: ${skipped} test(s) skipped with DB URLs set.`);
  process.exit(1);
}

process.exit(result.status ?? 1);
