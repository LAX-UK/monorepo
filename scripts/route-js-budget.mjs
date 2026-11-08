#!/usr/bin/env node
/**
 * Route JavaScript budget: the gzip size of the client JavaScript a route loads first, read from a
 * production build (`next build`), compared with the budget for its route group.
 *
 * What a route "loads first" is every script its `app-build-manifest.json` entry lists plus the
 * root main files (the framework, polyfills and runtime every page needs). Each file is gzipped
 * on its own, which is what a browser downloads, so the number is the transfer size and not the
 * parsed size. Code a page fetches later (a dynamic import) is not in the manifest and not counted.
 *
 * The check warns and exits 0 until BUDGET_ENFORCE=1 (two weeks of warnings first, then fail).
 * `--json` prints the table as JSON; `--chunks <route>` lists a route's chunks, largest first.
 *
 * Usage: node scripts/route-js-budget.mjs [--app apps/web] [--json] [--chunks "lot/"]
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const ROOT = path.resolve(import.meta.dirname, "..");
const KB = 1024;

/** Budgets in KB of gzip JavaScript, from the checkout design's performance targets. */
export const GROUPS = [
  {
    name: "public",
    budgetKb: 300,
    routes: [
      "/(marketing)/(home)/page",
      "/(marketing)/sales/(index)/page",
      "/(marketing)/sales/[slug]/[id]/page",
      "/(marketing)/lot/[slug]/[id]/page",
      "/(marketing)/results/page",
    ],
  },
];

/** The files a route loads first: the root main files and the route's own, scripts only. */
export function firstLoadFiles(appManifest, buildManifest, routeKey) {
  const listed = appManifest.pages?.[routeKey];
  if (!listed) return null;
  return [...new Set([...(buildManifest.rootMainFiles ?? []), ...listed])].filter((file) =>
    file.endsWith(".js"),
  );
}

/** Each group's routes with their gzip size, or `gzipKb: null` for a route the build lacks. */
export function budgetRows(groups, sizeOfRoute) {
  return groups.flatMap((group) =>
    group.routes.map((route) => ({
      route,
      group: group.name,
      budgetKb: group.budgetKb,
      gzipKb: sizeOfRoute(route),
    })),
  );
}

/**
 * What to print and whether to fail: warnings until `enforce`, errors after. A route the build
 * lacks is the same: it only fails once enforced, so a renamed route cannot break an unrelated PR
 * while the budget is still settling.
 */
export function verdict(rows, { enforce }) {
  const over = rows.filter((row) => row.gzipKb !== null && row.gzipKb > row.budgetKb);
  const missing = rows.filter((row) => row.gzipKb === null);
  const say = (message) => (enforce ? `error: ${message}` : `::warning::${message}`);
  const lines = [
    ...over.map((row) =>
      say(
        `${row.route} loads ${row.gzipKb.toFixed(0)} KB of JavaScript (gzip); the ${row.group} budget is ${row.budgetKb} KB`,
      ),
    ),
    ...missing.map((row) =>
      say(`${row.route} is not in the build manifest; update scripts/route-js-budget.mjs`),
    ),
  ];
  return { lines, failed: enforce && (missing.length > 0 || over.length > 0) };
}

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

function main(argv) {
  const args = { app: "apps/web", json: false, chunks: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--app") args.app = argv[++i];
    else if (argv[i] === "--json") args.json = true;
    else if (argv[i] === "--chunks") args.chunks = argv[++i];
  }
  const nextDir = path.join(ROOT, args.app, ".next");
  const enforce = process.env.BUDGET_ENFORCE === "1";
  let appManifest;
  let buildManifest;
  try {
    appManifest = readJson(path.join(nextDir, "app-build-manifest.json"));
    buildManifest = readJson(path.join(nextDir, "build-manifest.json"));
  } catch {
    const message = `no production build found in ${path.join(args.app, ".next")}; run next build first`;
    console.log(enforce ? `error: ${message}` : `::warning::${message}`);
    return enforce ? 1 : 0;
  }
  const gzipCache = new Map();
  const gzipKb = (file) => {
    if (!gzipCache.has(file)) {
      gzipCache.set(file, gzipSync(readFileSync(path.join(nextDir, file))).length / KB);
    }
    return gzipCache.get(file);
  };
  const chunksOf = (route) => {
    const files = firstLoadFiles(appManifest, buildManifest, route);
    return files
      ? files.map((file) => ({ file, gzipKb: gzipKb(file) })).sort((a, b) => b.gzipKb - a.gzipKb)
      : null;
  };

  if (args.chunks) {
    const route = GROUPS.flatMap((group) => group.routes).find((key) => key.includes(args.chunks));
    const chunks = route ? chunksOf(route) : null;
    if (!chunks) {
      console.error(`no route matching ${args.chunks}`);
      return 2;
    }
    for (const chunk of chunks) {
      console.log(`${chunk.gzipKb.toFixed(1).padStart(8)} KB  ${chunk.file}`);
    }
    return 0;
  }

  const rows = budgetRows(GROUPS, (route) => {
    const chunks = chunksOf(route);
    return chunks ? chunks.reduce((sum, chunk) => sum + chunk.gzipKb, 0) : null;
  });
  if (args.json) {
    console.log(JSON.stringify(rows, null, 2));
  } else {
    console.log("route JS (gzip, first load)");
    for (const row of rows) {
      const size = row.gzipKb === null ? "missing" : `${row.gzipKb.toFixed(0)} KB`;
      console.log(`  ${size.padStart(8)} / ${row.budgetKb} KB  ${row.route}`);
    }
  }
  const { lines, failed } = verdict(rows, { enforce });
  for (const line of lines) console.log(line);
  return failed ? 1 : 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  process.exit(main(process.argv.slice(2)));
}
