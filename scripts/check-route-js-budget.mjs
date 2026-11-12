#!/usr/bin/env node
/**
 * Route JavaScript budgets for every Next app. Reads the production build each app already has in
 * `.next` (it never builds), computes the gzip start-up JavaScript of every page route (what a
 * phone downloads: root files, layouts, boundaries and the page, duplicated modules counted as
 * shipped) and compares it with the budget for the route's group in `route-js-budgets.json`.
 *
 * An app with no build is skipped with a notice (CI only builds affected apps). Over-budget routes
 * are GitHub warning annotations, or errors that fail the run in a group with `enforce: true` (or
 * everywhere when `enforce` at the top of the config is true).
 *
 * An app marked `"requireSentry": true` must have been built with its client Sentry DSN set, so the
 * SDK's start-up code is in the bundle the budget measures; the check refuses a build without it.
 *
 * Tracked routes also have a per-route ratchet in `route-js-baseline.json`: the size each was
 * measured at, the target it is being brought down to, and a tolerance. A tracked route over its
 * ratchet fails the run in every group, enforced or not.
 *
 * Usage: node scripts/check-route-js-budget.mjs [--app apps/web ...] [--all] [--suggest] [--enforce]
 *                                               [--write-baseline]
 *   --all             print every route, not just the group summary and the over-budget routes
 *   --suggest         print each group's current largest route plus 10%, to review a budget change
 *   --enforce         fail on over-budget routes everywhere; also BUDGET_ENFORCE=1
 *   --write-baseline  record the current size of every tracked route as its new ratchet
 *   --allow-no-sentry measure a build made without the Sentry DSN (local runs; CI never does)
 *
 * Exit codes: 0 pass (or warnings only), 1 over budget under enforcement, 2 bad usage, config or
 * a build that does not match what the budget measures.
 */
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import {
  KB,
  auditApp,
  fullTable,
  overBudgetTable,
  suggestBudgetKb,
  summaryTable,
  verdict,
} from "./route-js-budget-rule.mjs";
import { chunkModules } from "./route-js-chunk-modules.mjs";
import {
  ratchetLines,
  ratchetResult,
  ratchetTable,
  refreshBaseline,
} from "./route-js-ratchet-rule.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const CONFIG_PATH = path.join(import.meta.dirname, "route-js-budgets.json");
const BASELINE_PATH = path.join(import.meta.dirname, "route-js-baseline.json");

const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));

/** Thrown for a command line the script refuses; `main` turns it into exit code 2. */
class UsageError extends Error {}

export function parseArgs(argv) {
  const args = {
    apps: [],
    all: false,
    suggest: false,
    enforce: false,
    writeBaseline: false,
    allowNoSentry: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--app") {
      const value = argv[++i];
      if (!value || value.startsWith("--")) throw new UsageError("--app needs an app path");
      args.apps.push(value);
    } else if (arg === "--all") args.all = true;
    else if (arg === "--suggest") args.suggest = true;
    else if (arg === "--enforce") args.enforce = true;
    else if (arg === "--write-baseline") args.writeBaseline = true;
    else if (arg === "--allow-no-sentry") args.allowNoSentry = true;
    else throw new UsageError(`unknown option ${arg}`);
  }
  return args;
}

/**
 * A DSN literal (`https://key@host/project`). The browser SDK's code is always in the bundle (the
 * router hook is imported), but `Sentry.init`, which is what the DSN switches on, and the weight
 * that comes with it are only there when the DSN was set at build time and got inlined.
 */
const SENTRY_DSN_LITERAL = /https?:\/\/[\w.-]+@[\w.-]+\/\d+/;

/**
 * Rows for one app, or `null` when it has no production build to read. A `requireSentry` app whose
 * main files hold no inlined Sentry DSN yields `{ error }` instead, unless `allowNoSentry` is set.
 */
function auditBuild({ root, app, appConfig, enforce, allowNoSentry }) {
  const nextDir = path.join(root, app, ".next");
  const appManifestPath = path.join(nextDir, "app-build-manifest.json");
  const buildManifestPath = path.join(nextDir, "build-manifest.json");
  if (!existsSync(appManifestPath) || !existsSync(buildManifestPath)) return null;
  const buildManifest = readJson(buildManifestPath);
  const chunks = new Map();
  const chunkOf = (file) => {
    if (!chunks.has(file)) {
      const code = readFileSync(path.join(nextDir, file));
      chunks.set(file, {
        gzipKb: gzipSync(code).length / KB,
        rawBytes: code.length,
        modules: chunkModules(code.toString("utf8")),
        code,
      });
    }
    return chunks.get(file);
  };
  if (appConfig.requireSentry && !allowNoSentry) {
    const bundled = (buildManifest.rootMainFiles ?? []).some((file) =>
      SENTRY_DSN_LITERAL.test(chunkOf(file).code.toString("utf8")),
    );
    if (!bundled) {
      return {
        error: `${app} was built without its Sentry DSN, so its budget would under-count what visitors download. Build it with NEXT_PUBLIC_SENTRY_DSN_WEB set (CI uses a placeholder DSN that sends nothing), or pass --allow-no-sentry to measure anyway.`,
      };
    }
  }
  return auditApp({
    app,
    appConfig,
    appManifest: readJson(appManifestPath),
    buildManifest,
    chunkOf,
    enforce,
  });
}

function suggestionLines(rows) {
  const lines = [];
  for (const app of new Set(rows.map((row) => row.app))) {
    for (const group of new Set(rows.filter((r) => r.app === app).map((r) => r.group))) {
      const members = rows.filter((r) => r.app === app && r.group === group);
      lines.push(`${app} ${group}: ${suggestBudgetKb(members)} KB`);
    }
  }
  return lines;
}

/**
 * Runs the audit and returns the exit code. `root`, `configPath`, `env` and `log` default to the
 * real repository, config file, process environment and console; tests pass their own.
 */
export function main(
  argv,
  {
    root = ROOT,
    configPath = CONFIG_PATH,
    baselinePath = BASELINE_PATH,
    env = process.env,
    log = console.log,
  } = {},
) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    console.error(error.message);
    return 2;
  }
  const config = readJson(configPath);
  const apps = args.apps.length > 0 ? args.apps : Object.keys(config.apps);
  const rows = [];
  const configEnforce = config.enforce === true;
  const forced = args.enforce || env.BUDGET_ENFORCE === "1";

  for (const app of apps) {
    const appConfig = config.apps[app];
    if (!appConfig) {
      console.error(`${app} has no entry in scripts/route-js-budgets.json`);
      return 2;
    }
    const appRows = auditBuild({
      root,
      app,
      appConfig,
      enforce: configEnforce,
      allowNoSentry: args.allowNoSentry,
    });
    if (appRows?.error) {
      console.error(appRows.error);
      return 2;
    }
    if (appRows === null) {
      log(`::notice title=Route JS budget::${app} has no production build; skipped`);
      continue;
    }
    rows.push(...appRows);
  }

  if (rows.length === 0) {
    log("No production builds found; nothing to audit.");
    return 0;
  }

  if (args.suggest) {
    for (const line of suggestionLines(rows)) log(line);
    return 0;
  }

  const baseline = existsSync(baselinePath) ? readJson(baselinePath) : { routes: {} };
  const measuredApps = [...new Set(rows.map((row) => row.app))];
  if (args.writeBaseline) {
    const refreshed = refreshBaseline({ rows, baseline, apps: measuredApps });
    writeFileSync(baselinePath, `${JSON.stringify(refreshed, null, 2)}\n`);
    log(`Recorded ${Object.keys(refreshed.routes).length} route ratchets in ${baselinePath}`);
    return 0;
  }

  const { lines, failed: budgetFailed } = verdict(rows, { enforce: forced });
  const ratchet = ratchetResult({ rows, baseline, apps: measuredApps });
  const ratchetOutput = ratchetLines(ratchet);
  const failed = budgetFailed || ratchet.over.length > 0 || ratchet.missing.length > 0;
  const summary = [
    "Route JS (gzip, start-up scripts; sizes in KB of 1024 bytes)",
    summaryTable(rows),
  ];
  if (Object.keys(baseline.routes).length > 0) {
    summary.push(
      "",
      "Tracked routes against their ratchet and target",
      ratchetTable({ rows, baseline, apps: measuredApps }),
    );
  }
  if (lines.length > 0) summary.push("", "Over budget", overBudgetTable(rows));
  if (args.all) summary.push("", "All routes", fullTable(rows));
  log(summary.join("\n"));
  for (const line of [...lines, ...ratchetOutput]) log(line);
  if (lines.some((line) => line.startsWith("::warning"))) {
    log(
      "Warnings do not fail the run: those groups have no `enforce: true` in scripts/route-js-budgets.json.",
    );
  }
  if (env.GITHUB_STEP_SUMMARY) {
    appendFileSync(
      env.GITHUB_STEP_SUMMARY,
      `### Route JS budget\n\n\`\`\`\n${summary.join("\n")}\n\`\`\`\n`,
    );
  }
  return failed ? 1 : 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  process.exit(main(process.argv.slice(2)));
}
