#!/usr/bin/env node
/**
 * Builds `apps/art/src/lib/seo/thelax-art-redirects.json`, the single source for the
 * thelax.art → lax.art host move (see docs/runbooks/thelax-art-seo-migration.md).
 *
 * Inputs (both committed):
 *  - `docs/seo/legacy-thelax-inventory.json`: every public thelax.art URL with its title and
 *    family, from `pnpm seo:crawl-legacy`;
 *  - `apps/art/src/lib/seo/legacy-redirects.json`: the legacy path → new route map written by the
 *    shop-api importer.
 *
 * Each row records the old URL, its title and type, the lax.art route it moves to and how good
 * that match is (`exact`, `best-match`, `no-equivalent`). Re-run after a re-crawl or re-import:
 *
 *   node scripts/seo/build-thelax-art-redirects.mjs
 *   pnpm exec biome format --write apps/art/src/lib/seo/thelax-art-redirects.json
 */
import { readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";

const { values: args } = parseArgs({
  options: {
    inventory: { type: "string", default: "docs/seo/legacy-thelax-inventory.json" },
    map: { type: "string", default: "apps/art/src/lib/seo/legacy-redirects.json" },
    out: { type: "string", default: "apps/art/src/lib/seo/thelax-art-redirects.json" },
  },
});

/** Section and listing pages on lax.art: a target here is a fallback, not the same content. */
const SECTION_ROUTES = new Set([
  "/artworks",
  "/artists",
  "/stories",
  "/collector-hub",
  "/exhibitions",
  "/art-hub",
]);

/** Old pages that are themselves listings, so landing on the matching listing is the best fit. */
const LISTING_PAGES = new Set([
  "/all-collections",
  "/all-prints",
  "/all-sculptures",
  "/art-news",
  "/art-prints",
  "/artist",
  "/collections",
]);

/** Paths live on both sites, served by the same kind of page. */
const SAME_PATH_PAGES = new Set(["/", "/paintings", "/prints", "/sculptures"]);

/**
 * Old URLs with no lax.art counterpart and no row in the importer's map. `/site-map` was an HTML
 * index of every page; nothing narrower than the home page covers it.
 */
const NO_EQUIVALENT_FALLBACKS = { "/site-map": "/" };

/** Inventory family → the content type the migration report uses. */
const TYPE_BY_FAMILY = {
  home: "page",
  page: "page",
  glossary: "page",
  artwork: "artwork",
  artist: "artist",
  story: "post",
  series: "category",
  taxonomy: "category",
};

/** Windows-1252 characters for bytes 0x80–0x9F; every other byte maps to the same code point. */
const CP1252_HIGH = "€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008DŽ\u008F\u0090‘’“”•–—˜™š›œ\u009DžŸ";

/** Some old titles were UTF-8 read as Windows-1252 (`â€“` for `–`); undo that where it applies. */
function fixMojibake(text) {
  if (!text || !/[âÃ]/.test(text)) return text ?? null;
  const bytes = [];
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    const high = CP1252_HIGH.indexOf(char);
    if (high >= 0) bytes.push(0x80 + high);
    else if (code <= 0xff) bytes.push(code);
    else return text;
  }
  const decoded = Buffer.from(bytes).toString("utf8");
  return decoded.includes("�") ? text : decoded;
}

function lastSegment(path) {
  return (
    path
      .replace(/\.html$/, "")
      .split("/")
      .pop() ?? ""
  );
}

function classify({ from, family, to }) {
  const path = from.split("?")[0];
  if (path in NO_EQUIVALENT_FALLBACKS) return "no-equivalent";
  if (SAME_PATH_PAGES.has(path)) return path === "/prints" ? "best-match" : "exact";
  if (from.includes("?")) return "best-match";
  if (/^https?:/.test(to)) return "best-match";
  if (SECTION_ROUTES.has(to)) return LISTING_PAGES.has(path) ? "best-match" : "no-equivalent";
  if (LISTING_PAGES.has(path)) return "best-match";
  switch (family) {
    case "artwork":
    case "artist":
    case "story":
      return "exact";
    case "series":
    case "taxonomy":
      return "best-match";
    default:
      break;
  }
  if (to.startsWith("/legal/") || to === "/contact") return "exact";
  // Content pages imported one-for-one keep their slug under the collector hub.
  if (to.startsWith("/collector-hub/") && lastSegment(to) === lastSegment(path)) return "exact";
  return "best-match";
}

function targetFor(path, map) {
  if (map[path]) return map[path];
  if (SAME_PATH_PAGES.has(path)) return path;
  if (path in NO_EQUIVALENT_FALLBACKS) return NO_EQUIVALENT_FALLBACKS[path];
  return null;
}

const inventory = JSON.parse(await readFile(args.inventory, "utf8"));
const legacyMap = JSON.parse(await readFile(args.map, "utf8")).redirects;

const rows = [];
const seen = new Set();
const unmapped = [];

for (const entry of inventory.entries) {
  const path = entry.path.split("?")[0];
  const to = targetFor(path, legacyMap);
  if (!to) {
    unmapped.push(entry.path);
    continue;
  }
  seen.add(entry.path);
  rows.push({
    from: entry.path,
    to,
    type: TYPE_BY_FAMILY[entry.family] ?? "page",
    title: fixMojibake(entry.title),
    match: classify({ from: entry.path, family: entry.family, to }),
  });
}

// Policy aliases the old site answered without listing them in its sitemap.
for (const [from, to] of Object.entries(legacyMap)) {
  if (seen.has(from) || from.startsWith("/uds/")) continue;
  rows.push({ from, to, type: "page", title: null, match: classify({ from, family: "page", to }) });
}

if (unmapped.length > 0) {
  console.error(`No target for ${unmapped.length} URL(s):\n  ${unmapped.join("\n  ")}`);
  process.exit(1);
}

rows.sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));

const counts = { total: rows.length, exact: 0, "best-match": 0, "no-equivalent": 0 };
for (const row of rows) counts[row.match] += 1;

const output = {
  schemaVersion: 1,
  sourceOrigin: "https://thelax.art",
  sourceHosts: ["thelax.art", "www.thelax.art"],
  inventoryCrawledAt: inventory.crawledAt,
  counts,
  rows,
};
await writeFile(args.out, `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify(counts));
