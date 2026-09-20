#!/usr/bin/env node
/**
 * Refreshes Playwright visual regression baselines.
 * - web admin (default): apps/web admin surfaces
 * - web marketing (opt-in): UPDATE_MARKETING_VISUALS=1
 * - shop: full Shop Playwright suite including @visual and hosted-auth screenshots
 *
 * Usage: node scripts/ci/update-visual-baselines.mjs [web|shop|all]
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

function updateShop() {
  const shopDir = path.join(ROOT, "apps/shop");
  console.log("Updating Shop visual baselines (full e2e suite with --update-snapshots)…");
  runIn(shopDir, "test:e2e:visual-update", {
    PLAYWRIGHT_BASE_URL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3020",
  });
  console.log(
    "Shop visual baselines updated. Commit snapshot diffs under apps/shop/e2e/__screenshots__/.",
  );
}

if (target === "web") {
  updateWeb();
} else if (target === "shop") {
  updateShop();
} else if (target === "all") {
  updateWeb();
  updateShop();
} else {
  console.error(`Unknown target "${target}". Use web, shop, or all.`);
  process.exit(1);
}
