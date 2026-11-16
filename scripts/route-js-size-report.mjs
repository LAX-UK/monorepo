#!/usr/bin/env node
/**
 * Route JavaScript size report: the exact start-up JavaScript of every page route of the Next apps,
 * in bytes, written as JSON so two builds can be compared route by route
 * (`route-js-size-compare.mjs`). It measures what `check-route-js-budget.mjs` measures (the gzip
 * size of each start-up script on its own, summed per route; see `route-js-startup-set.mjs`) but
 * keeps whole bytes and judges nothing: budgets and ratchets stay in the budget check.
 *
 * It reads the `.next` output an app already has (it never builds) and skips an app with none.
 * Each app also gets a digest of every client script it built, so two builds of one commit can be
 * shown to be byte-identical, not just equal in size.
 *
 * Usage: node scripts/route-js-size-report.mjs [--root <dir>] [--app apps/web ...] [--out <file>]
 *                                              [--label <text>]
 *   --root   the checkout to read (default: this repository); CI passes it when running a copy of
 *            this script kept outside the checkout
 *   --app    only these apps (default: every app in SIZE_APPS)
 *   --out    write the JSON there (default: print it)
 *   --label  stored in the report, for example the commit it was built from
 *
 * Exit codes: 0 written, 2 bad usage.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { isIgnored, pageRoutes } from "./route-js-budget-rule.mjs";
import { startupSet } from "./route-js-startup-set.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const CONFIG_PATH = path.join(import.meta.dirname, "route-js-budgets.json");

/**
 * Every production Next app CI builds with the size-build settings. The four with budgets come
 * from `route-js-budgets.json`; Shop Admin has no budget and is reported only.
 */
export const REPORT_ONLY_APPS = ["apps/shop-admin"];

export const REPORT_VERSION = 1;

const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));

class UsageError extends Error {}

export function parseArgs(argv) {
  const args = { root: ROOT, apps: [], out: null, label: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = () => {
      const next = argv[++i];
      if (!next || next.startsWith("--")) throw new UsageError(`${arg} needs a value`);
      return next;
    };
    if (arg === "--root") args.root = path.resolve(value());
    else if (arg === "--app") args.apps.push(value());
    else if (arg === "--out") args.out = value();
    else if (arg === "--label") args.label = value();
    else throw new UsageError(`unknown option ${arg}`);
  }
  return args;
}

/** The apps a report covers: the budgeted apps, then the report-only ones. */
export function sizeApps(config) {
  return [...Object.keys(config.apps), ...REPORT_ONLY_APPS.filter((app) => !config.apps[app])];
}

function listFiles(dir, prefix = "") {
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    const full = path.join(dir, name);
    const rel = prefix ? `${prefix}/${name}` : name;
    if (statSync(full).isDirectory()) out.push(...listFiles(full, rel));
    else out.push(rel);
  }
  return out;
}

/**
 * The report entry for one app, or `null` when it has no production build. `appConfig` supplies
 * the routes the budget check ignores (the Bid staff area, for example), so both tools measure the
 * same routes; an app without one reports every page route.
 */
export function appReport({ nextDir, appConfig }) {
  const appManifestPath = path.join(nextDir, "app-build-manifest.json");
  const buildManifestPath = path.join(nextDir, "build-manifest.json");
  if (!existsSync(appManifestPath) || !existsSync(buildManifestPath)) return null;
  const appManifest = readJson(appManifestPath);
  const buildManifest = readJson(buildManifestPath);
  const files = new Map();
  const fileOf = (file) => {
    if (!files.has(file)) {
      const code = readFileSync(path.join(nextDir, file));
      files.set(file, { gzipBytes: gzipSync(code).length, rawBytes: code.length });
    }
    return files.get(file);
  };
  const routes = {};
  for (const route of pageRoutes(appManifest).sort()) {
    if (appConfig && isIgnored(appConfig, route)) continue;
    const { frame, page } = startupSet(appManifest, buildManifest, route);
    const startup = [...frame, ...page];
    routes[route] = {
      gzipBytes: startup.reduce((sum, file) => sum + fileOf(file).gzipBytes, 0),
      rawBytes: startup.reduce((sum, file) => sum + fileOf(file).rawBytes, 0),
      files: startup.length,
    };
  }
  // Every client script, not only start-up ones: two builds of one commit should match exactly.
  // The build id is random per build and only names the directory of `_buildManifest.js`; it is
  // not inside any script, so the digest replaces it with a placeholder.
  const staticDir = path.join(nextDir, "static");
  const buildIdPath = path.join(nextDir, "BUILD_ID");
  const buildId = existsSync(buildIdPath) ? readFileSync(buildIdPath, "utf8").trim() : null;
  const scripts = existsSync(staticDir)
    ? listFiles(staticDir)
        .filter((rel) => rel.endsWith(".js"))
        .map((rel) => ({
          name:
            buildId && rel.startsWith(`${buildId}/`)
              ? `<build-id>${rel.slice(buildId.length)}`
              : rel,
          hash: createHash("sha256")
            .update(readFileSync(path.join(staticDir, rel)))
            .digest("hex"),
        }))
        .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    : [];
  const digest = createHash("sha256");
  for (const { name, hash } of scripts) digest.update(`${name}\0${hash}\n`);
  return { routes, clientScripts: scripts.length, clientDigest: digest.digest("hex") };
}

/** The whole report: one entry per app that has a build. */
export function sizeReport({ root, apps, config, label = null }) {
  const report = { version: REPORT_VERSION, label, apps: {} };
  for (const app of apps) {
    const entry = appReport({
      nextDir: path.join(root, app, ".next"),
      appConfig: config.apps[app],
    });
    if (entry) report.apps[app] = entry;
  }
  return report;
}

export function main(argv, { configPath = CONFIG_PATH, log = console.log } = {}) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    console.error(error.message);
    return 2;
  }
  const config = readJson(configPath);
  const apps = args.apps.length > 0 ? args.apps : sizeApps(config);
  const report = sizeReport({ root: args.root, apps, config, label: args.label });
  const json = `${JSON.stringify(report, null, 2)}\n`;
  if (args.out) {
    writeFileSync(args.out, json);
    const measured = Object.entries(report.apps).map(
      ([app, entry]) => `${app} (${Object.keys(entry.routes).length} routes)`,
    );
    log(`Route JS size report: ${measured.join(", ") || "no builds found"} -> ${args.out}`);
  } else {
    log(json.trimEnd());
  }
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  process.exit(main(process.argv.slice(2)));
}
