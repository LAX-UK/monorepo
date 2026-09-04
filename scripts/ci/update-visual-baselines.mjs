#!/usr/bin/env node
/**
 * Refreshes Playwright visual regression baselines for admin surfaces.
 * Marketing baselines are opt-in via UPDATE_MARKETING_VISUALS=1 (no committed set yet).
 * Requires local stack: web :3000, API :3001, Node 22.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertRepoNodeVersion } from "./require-node-version.mjs";

assertRepoNodeVersion({ tool: "Visual baseline update" });

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webDir = path.join(ROOT, "apps/web");

function run(script) {
  const result = spawnSync("pnpm", ["run", script], {
    cwd: webDir,
    stdio: "inherit",
    env: { ...process.env, PLAYWRIGHT_E2E: "1", PLAYWRIGHT_VISUAL: "1" },
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log("Updating admin visual baselines…");
run("test:e2e:admin-visual-update");
if (process.env.UPDATE_MARKETING_VISUALS === "1") {
  console.log("Updating marketing visual baselines…");
  run("test:e2e:marketing-visual-update");
}
console.log("Visual baselines updated. Commit snapshot diffs under apps/web/e2e/.");
