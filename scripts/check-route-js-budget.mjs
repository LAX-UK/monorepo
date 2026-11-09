#!/usr/bin/env node
/**
 * Route JavaScript budgets for every Next app. Reads the production build each app already has in
 * `.next` (it never builds), computes the gzip first-load JavaScript of every page route, and
 * compares it with the budget for the route's group in `route-js-budgets.json`.
 *
 * An app with no build is skipped with a notice (CI only builds affected apps). Over-budget routes
 * are GitHub warning annotations until `enforce` in the config is true, then errors that fail.
 *
 * Usage: node scripts/check-route-js-budget.mjs [--app apps/web ...] [--all] [--suggest]
 *   --all      print every route, not just the group summary and the over-budget routes
 *   --suggest  print each group's current largest route plus 10%, to review a budget change
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

function parseArgs(argv) {
  const args = { apps: [], all: false, suggest: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--app") args.apps.push(argv[++i]);
    else if (argv[i] === "--all") args.all = true;
    else if (argv[i] === "--suggest") args.suggest = true;
  }
  return args;
}

function main(argv) {
  const args = parseArgs(argv);
  const config = readJson(CONFIG_PATH);
  const apps = args.apps.length > 0 ? args.apps : Object.keys(config.apps);
  const rows = [];

  for (const app of apps) {
    const appConfig = config.apps[app];
    if (!appConfig) {
      console.error(`${app} has no entry in scripts/route-js-budgets.json`);
      return 2;
    }
    const nextDir = path.join(ROOT, app, ".next");
    const appManifestPath = path.join(nextDir, "app-build-manifest.json");
    const buildManifestPath = path.join(nextDir, "build-manifest.json");
    if (!existsSync(appManifestPath) || !existsSync(buildManifestPath)) {
      console.log(`::notice title=Route JS budget::${app} has no production build; skipped`);
      continue;
    }
    const gzipCache = new Map();
    const gzipKbOf = (file) => {
      if (!gzipCache.has(file)) {
        gzipCache.set(file, gzipSync(readFileSync(path.join(nextDir, file))).length / KB);
      }
      return gzipCache.get(file);
    };
    rows.push(
      ...auditApp({
        app,
        appConfig,
        appManifest: readJson(appManifestPath),
        buildManifest: readJson(buildManifestPath),
        gzipKbOf,
      }),
    );
  }

  if (rows.length === 0) {
    console.log("No production builds found; nothing to audit.");
    return 0;
  }

  if (args.suggest) {
    for (const app of new Set(rows.map((row) => row.app))) {
      for (const group of new Set(rows.filter((r) => r.app === app).map((r) => r.group))) {
        const members = rows.filter((r) => r.app === app && r.group === group);
        console.log(`${app} ${group}: ${suggestBudgetKb(members)} KB`);
      }
    }
    return 0;
  }

  const enforce = config.enforce === true;
  const { lines, failed } = verdict(rows, { enforce });
  const summary = ["Route JS (gzip, first load)", summaryTable(rows)];
  if (lines.length > 0) summary.push("", "Over budget", overBudgetTable(rows));
  if (args.all) summary.push("", "All routes", fullTable(rows));
  console.log(summary.join("\n"));
  for (const line of lines) console.log(line);
  if (lines.length > 0 && !enforce) {
    console.log("Budgets are warnings only (enforce is false in scripts/route-js-budgets.json).");
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `### Route JS budget\n\n\`\`\`\n${summary.join("\n")}\n\`\`\`\n`,
    );
  }
  return failed ? 1 : 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  process.exit(main(process.argv.slice(2)));
}
