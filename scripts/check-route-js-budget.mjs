#!/usr/bin/env node
/**
 * Route JavaScript budgets for every Next app. Reads the production build each app already has in
 * `.next` (it never builds), computes the gzip first-load JavaScript of every page route, and
 * compares it with the budget for the route's group in `route-js-budgets.json`.
 *
 * An app with no build is skipped with a notice (CI only builds affected apps). Over-budget routes
 * are GitHub warning annotations until `enforce` in the config is true, then errors that fail.
 *
 * Usage: node scripts/check-route-js-budget.mjs [--app apps/web ...] [--all] [--suggest] [--enforce]
 *   --all      print every route, not just the group summary and the over-budget routes
 *   --suggest  print each group's current largest route plus 10%, to review a budget change
 *   --enforce  fail on over-budget routes; also set by BUDGET_ENFORCE=1 or `enforce` in the config
 *
 * Exit codes: 0 pass (or warnings only), 1 over budget under enforcement, 2 bad usage or config.
 */
import { appendFileSync, existsSync, readFileSync } from "node:fs";
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

const ROOT = path.resolve(import.meta.dirname, "..");
const CONFIG_PATH = path.join(import.meta.dirname, "route-js-budgets.json");

const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));

/** Thrown for a command line the script refuses; `main` turns it into exit code 2. */
class UsageError extends Error {}

export function parseArgs(argv) {
  const args = { apps: [], all: false, suggest: false, enforce: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--app") {
      const value = argv[++i];
      if (!value || value.startsWith("--")) throw new UsageError("--app needs an app path");
      args.apps.push(value);
    } else if (arg === "--all") args.all = true;
    else if (arg === "--suggest") args.suggest = true;
    else if (arg === "--enforce") args.enforce = true;
    else throw new UsageError(`unknown option ${arg}`);
  }
  return args;
}

/** Rows for one app, or `null` when it has no production build to read. */
function auditBuild({ root, app, appConfig }) {
  const nextDir = path.join(root, app, ".next");
  const appManifestPath = path.join(nextDir, "app-build-manifest.json");
  const buildManifestPath = path.join(nextDir, "build-manifest.json");
  if (!existsSync(appManifestPath) || !existsSync(buildManifestPath)) return null;
  const gzipCache = new Map();
  const gzipKbOf = (file) => {
    if (!gzipCache.has(file)) {
      gzipCache.set(file, gzipSync(readFileSync(path.join(nextDir, file))).length / KB);
    }
    return gzipCache.get(file);
  };
  return auditApp({
    app,
    appConfig,
    appManifest: readJson(appManifestPath),
    buildManifest: readJson(buildManifestPath),
    gzipKbOf,
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
  { root = ROOT, configPath = CONFIG_PATH, env = process.env, log = console.log } = {},
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

  for (const app of apps) {
    const appConfig = config.apps[app];
    if (!appConfig) {
      console.error(`${app} has no entry in scripts/route-js-budgets.json`);
      return 2;
    }
    const appRows = auditBuild({ root, app, appConfig });
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

  const enforce = config.enforce === true || args.enforce || env.BUDGET_ENFORCE === "1";
  const { lines, failed } = verdict(rows, { enforce });
  const summary = ["Route JS (gzip, first load)", summaryTable(rows)];
  if (lines.length > 0) summary.push("", "Over budget", overBudgetTable(rows));
  if (args.all) summary.push("", "All routes", fullTable(rows));
  log(summary.join("\n"));
  for (const line of lines) log(line);
  if (lines.length > 0 && !enforce) {
    log("Budgets are warnings only (enforce is false in scripts/route-js-budgets.json).");
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
