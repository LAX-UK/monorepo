#!/usr/bin/env node
/**
 * Single command path for local and GitHub PR browser gates.
 * Static checks fail in seconds; auth mint + Playwright share this script.
 */
import { spawnSync } from "node:child_process";
import { parseArgs } from "node:util";
import { assertRepoNodeVersion } from "./require-node-version.mjs";

assertRepoNodeVersion({ tool: "PR browser gates" });

const args = parseArgs({
  options: {
    "skip-static": { type: "boolean", default: false },
    "skip-prepare": { type: "boolean", default: false },
  },
});

function run(command, extraEnv = {}) {
  const result = spawnSync(command, {
    stdio: "inherit",
    shell: true,
    env: { ...process.env, ...extraEnv },
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (!args.values["skip-static"]) {
  run("pnpm exec biome check .");
  run("node --test scripts/ci/e2e-session-state.test.mjs");
  run("node --test scripts/ci/require-node-version.test.mjs");
  run("node scripts/ci/require-node-version.mjs");
  run('pnpm --filter @auction/web exec playwright test --list --grep "@smoke|@visual|@roles"');
}

if (!args.values["skip-prepare"]) {
  run("pnpm --filter @auction/web exec node ../../scripts/ci/prepare-e2e-auth-states.mjs");
}

run("pnpm --filter @auction/web test:e2e:pr", {
  PLAYWRIGHT_E2E: "1",
  PLAYWRIGHT_VISUAL: "1",
  PLAYWRIGHT_AUTH_PREPARED: "1",
});
