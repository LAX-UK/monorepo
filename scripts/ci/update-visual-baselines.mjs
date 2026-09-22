#!/usr/bin/env node
/**
 * Refreshes Playwright visual regression baselines for web admin (and opt-in marketing).
 *
 * Usage: node scripts/ci/update-visual-baselines.mjs [web|all]
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertRepoNodeVersion } from "./require-node-version.mjs";

assertRepoNodeVersion({ tool: "Visual baseline update" });

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const target = (process.argv[2] ?? "web").toLowerCase();

function runIn(cwd, script, extraEnv = {}) {
  const result = spawnSync("pnpm", ["run", script], {
    cwd,
    stdio: "inherit",
    env: { ...process.env, PLAYWRIGHT_E2E: "1", PLAYWRIGHT_VISUAL: "1", ...extraEnv },
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function updateWeb() {
  const webDir = path.join(ROOT, "apps/web");
  console.log("Updating admin visual baselines…");
  runIn(webDir, "test:e2e:admin-visual-update");
  if (process.env.UPDATE_MARKETING_VISUALS === "1") {
    console.log("Updating marketing visual baselines…");
    runIn(webDir, "test:e2e:marketing-visual-update");
  }
  console.log("Web visual baselines updated. Commit snapshot diffs under apps/web/e2e/.");
}

if (target === "web" || target === "all") {
  updateWeb();
} else if (target === "shop") {
  console.error(
    "Shop storefront no longer uses Playwright screenshot baselines. Use apps/shop test:e2e for behavior gates.",
  );
  process.exit(1);
} else {
  console.error(`Unknown target "${target}". Use web or all.`);
  process.exit(1);
}
