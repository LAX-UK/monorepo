#!/usr/bin/env node
/**
 * Crawls the legacy www.thelax.art sitemap and writes:
 *  - the committed URL inventory (`docs/seo/legacy-thelax-inventory.json`): status and SEO
 *    surface of every legacy URL, the baseline that redirect verification checks against;
 *  - the content export (`.tmp/seo/legacy-thelax-export.json`) read by
 *    `pnpm --filter @auction/shop-api import:legacy-thelax`.
 *
 * Usage: node scripts/seo/crawl-legacy-thelax.mjs [--limit N] [--refresh] [--concurrency N]
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import { buildLegacyExport } from "./lib/legacy-thelax-export.mjs";
import { extractSeo, parseLegacyHtml } from "./lib/legacy-thelax-extract.mjs";
import {
  LEGACY_THELAX_ORIGIN,
  classifyLegacyUrl,
  parseSitemapLocs,
} from "./lib/legacy-thelax-urls.mjs";

const { values: args } = parseArgs({
  options: {
    origin: { type: "string", default: LEGACY_THELAX_ORIGIN },
    "inventory-out": { type: "string", default: "docs/seo/legacy-thelax-inventory.json" },
    "export-out": { type: "string", default: ".tmp/seo/legacy-thelax-export.json" },
    "cache-dir": { type: "string", default: ".tmp/seo/html" },
    concurrency: { type: "string", default: "4" },
    limit: { type: "string" },
    refresh: { type: "boolean", default: false },
  },
});

/** Linked from the old navigation but missing from its sitemap. */
const EXTRA_PATHS = ["/corporate"];
const USER_AGENT = "LAX-SEO-Migration/1.0 (+https://www.thelax.art)";
const MAX_ATTEMPTS = 3;

async function fetchPage(url) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const res = await fetch(url, {
        redirect: "manual",
        headers: { "user-agent": USER_AGENT, accept: "text/html,application/xml" },
        signal: AbortSignal.timeout(30_000),
      });
      const body = res.status >= 300 && res.status < 400 ? "" : await res.text();
      return { status: res.status, location: res.headers.get("location"), body };
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 1_000));
    }
  }
  throw new Error(`fetch failed for ${url}: ${lastError?.message ?? lastError}`);
}

function cachePath(url) {
  return join(args["cache-dir"], `${createHash("sha1").update(url).digest("hex")}.json`);
}

async function fetchCached(url) {
  const file = cachePath(url);
  if (!args.refresh) {
    try {
      return JSON.parse(await readFile(file, "utf8"));
    } catch {
      // cache miss
    }
  }
  const page = await fetchPage(url);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(page));
  return page;
}

async function mapConcurrent(items, concurrency, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

function contentImages(cls, html) {
  if (cls.family !== "artwork" && cls.family !== "story") return undefined;
  const urls = [...html.matchAll(/https:\/\/www\.thelax\.art\/uds\/(?:stock|articles)\/[^"'\s)]+/g)]
    .map((match) => match[0])
    .filter((url) => !/\/thumb1?\//.test(url));
  return [...new Set(urls)].sort();
}

async function main() {
  const origin = args.origin.replace(/\/$/, "");
  const sitemap = await fetchPage(`${origin}/sitemap.xml`);
  if (sitemap.status !== 200) throw new Error(`sitemap returned ${sitemap.status}`);
  const sitemapUrls = parseSitemapLocs(sitemap.body);
  const urls = [...new Set([...sitemapUrls, ...EXTRA_PATHS.map((path) => `${origin}${path}`)])];
  const limit = args.limit ? Number(args.limit) : urls.length;
  const targets = urls.slice(0, limit);
  console.log(`crawl: ${sitemapUrls.length} sitemap URLs, crawling ${targets.length}`);

  let done = 0;
  const pages = await mapConcurrent(targets, Number(args.concurrency), async (url) => {
    const page = await fetchCached(url);
    done += 1;
    if (done % 50 === 0) console.log(`crawl: ${done}/${targets.length}`);
    return { url, ...page };
  });

  const entries = pages.map(({ url, status, location, body }) => {
    const parsed = new URL(url);
    const cls = classifyLegacyUrl(url);
    const seo = status === 200 ? extractSeo(parseLegacyHtml(body)) : null;
    return {
      path: `${parsed.pathname}${parsed.search}`,
      family: cls.family,
      inSitemap: sitemapUrls.includes(url),
      status,
      ...(location ? { location } : {}),
      ...(seo ?? {}),
      ...(status === 200 ? { images: contentImages(cls, body) } : {}),
    };
  });
  entries.sort((a, b) => a.path.localeCompare(b.path));
  const crawledAt = new Date().toISOString();
  const inventory = {
    schemaVersion: 1,
    origin,
    crawledAt,
    sitemapUrlCount: sitemapUrls.length,
    entries,
  };
  await mkdir(dirname(args["inventory-out"]), { recursive: true });
  await writeFile(args["inventory-out"], `${JSON.stringify(inventory, null, 2)}\n`);

  const exported = buildLegacyExport(
    pages.filter((page) => page.status === 200),
    { origin, generatedAt: crawledAt },
  );
  await mkdir(dirname(args["export-out"]), { recursive: true });
  await writeFile(args["export-out"], `${JSON.stringify(exported, null, 2)}\n`);

  const byStatus = Object.groupBy(entries, (entry) => String(entry.status));
  console.log(
    `crawl: inventory ${entries.length} URLs (${Object.entries(byStatus)
      .map(([status, list]) => `${status}: ${list.length}`)
      .join(", ")}) -> ${args["inventory-out"]}`,
  );
  console.log(
    `crawl: export ${exported.artworks.length} artworks, ${exported.artists.length} artists, ` +
      `${exported.stories.length} stories, ${exported.pages.length} pages, ` +
      `${exported.taxonomies.length} taxonomy pages, ${exported.series.length} series -> ${args["export-out"]}`,
  );
}

await main();
