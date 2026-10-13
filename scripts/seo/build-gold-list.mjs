#!/usr/bin/env node
/**
 * Builds the legacy gold list (URLs that must pass every redirect check) from owner exports.
 *
 * Usage:
 *   node scripts/seo/build-gold-list.mjs \
 *     --gsc-pages exports/gsc-pages.csv [--gsc-pages exports/gsc-domain-pages.csv] \
 *     --links exports/gsc-top-linked-pages.csv [--links exports/ahrefs-best-by-links.csv] \
 *     --ga4-landing exports/ga4-organic-landing-pages.csv
 *
 * See docs/runbooks/thelax-seo-migration.md (Phase 0) for how to produce each export.
 */
import { readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import {
  buildGoldList,
  legacyKey,
  readGa4LandingPages,
  readLinkedPages,
  readSearchConsolePages,
} from "./lib/legacy-thelax-gold-list.mjs";

const { values: args } = parseArgs({
  options: {
    "gsc-pages": { type: "string", multiple: true, default: [] },
    links: { type: "string", multiple: true, default: [] },
    "ga4-landing": { type: "string", multiple: true, default: [] },
    inventory: { type: "string", default: "docs/seo/legacy-thelax-inventory.json" },
    out: { type: "string", default: "docs/seo/legacy-thelax-gold-list.json" },
    top: { type: "string", default: "200" },
  },
});

async function readAll(files, reader) {
  const rows = [];
  for (const file of files) rows.push(...reader(await readFile(file, "utf8")));
  return rows;
}

if (args["gsc-pages"].length === 0 && args.links.length === 0) {
  console.error("gold-list: pass at least one --gsc-pages or --links export");
  process.exit(1);
}

const inventory = JSON.parse(await readFile(args.inventory, "utf8"));
const inventoryPaths = new Set(inventory.entries.map((entry) => legacyKey(entry.path)));
const gold = buildGoldList({
  pages: await readAll(args["gsc-pages"], readSearchConsolePages),
  links: await readAll(args.links, readLinkedPages),
  landing: await readAll(args["ga4-landing"], readGa4LandingPages),
  inventoryPaths,
  top: Number(args.top),
});

await writeFile(
  args.out,
  `${JSON.stringify({ schemaVersion: 1, generatedAt: new Date().toISOString(), entries: gold }, null, 2)}\n`,
);
const missing = gold.filter((item) => item.reasons.includes("not-in-inventory"));
console.log(`gold-list: ${gold.length} URLs -> ${args.out}`);
if (missing.length > 0) {
  console.log(
    `gold-list: ${missing.length} gold URLs are not in the crawl inventory (add mappings):`,
  );
  for (const item of missing.slice(0, 50)) console.log(`  ${item.path}`);
}
