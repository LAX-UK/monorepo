#!/usr/bin/env node
/**
 * Verifies the deployed LAX Art legacy-redirect layer for every legacy URL in the crawl
 * inventory plus the gold list: exactly one 301 to the mapped path, then a 200 destination
 * with a self-referencing canonical, no noindex, and a title and meta description.
 *
 * Usage:
 *   node scripts/seo/verify-legacy-redirects.mjs [--base-url https://test-art.lax.bid]
 *     [--host www.thelax.art] [--canonical-origin https://www.thelax.art]
 *     [--destinations all|gold|none] [--allow-noindex] [--concurrency 4] [--limit N]
 *
 * `--host` sends that Host header (and TLS SNI) to `--base-url`, so production can be checked
 * against the App Platform origin before DNS moves. See docs/runbooks/thelax-seo-migration.md.
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import http from "node:http";
import https from "node:https";
import { dirname } from "node:path";
import { parseArgs } from "node:util";
import {
  buildVerificationTargets,
  checkDestination,
  checkRedirectHop,
  isExternalTarget,
  parityGaps,
} from "./lib/legacy-redirect-verify.mjs";

const { values: args } = parseArgs({
  options: {
    "base-url": { type: "string", default: "https://test-art.lax.bid" },
    host: { type: "string" },
    "canonical-origin": { type: "string" },
    inventory: { type: "string", default: "docs/seo/legacy-thelax-inventory.json" },
    gold: { type: "string", default: "docs/seo/legacy-thelax-gold-list.json" },
    redirects: { type: "string", default: "apps/art/src/lib/seo/legacy-redirects.json" },
    destinations: { type: "string", default: "all" },
    "allow-noindex": { type: "boolean", default: false },
    concurrency: { type: "string", default: "4" },
    limit: { type: "string" },
    report: { type: "string", default: ".tmp/seo/verify-legacy-redirects.json" },
  },
});

if (!["all", "gold", "none"].includes(args.destinations)) {
  console.error("verify-legacy-redirects: --destinations must be all, gold or none");
  process.exit(2);
}

const baseUrl = new URL(args["base-url"]);
const hostOverride = args.host?.trim() || undefined;
const canonicalOrigin = new URL(
  args["canonical-origin"] ?? (hostOverride ? `https://${hostOverride}` : baseUrl.origin),
).origin;
const USER_AGENT = "LAX-SEO-Migration-Verify/1.0 (+https://www.thelax.art)";
const MAX_ATTEMPTS = 3;
const MAX_BODY_BYTES = 4 * 1024 * 1024;

function requestOnce(path, { readBody }) {
  const url = new URL(path, baseUrl);
  const client = url.protocol === "http:" ? http : https;
  return new Promise((resolve, reject) => {
    const req = client.request(
      url,
      {
        method: "GET",
        headers: {
          "user-agent": USER_AGENT,
          accept: "text/html",
          ...(hostOverride ? { host: hostOverride } : {}),
        },
        ...(hostOverride && url.protocol === "https:" ? { servername: hostOverride } : {}),
        timeout: 30_000,
      },
      (res) => {
        const result = {
          status: res.statusCode ?? 0,
          location: res.headers.location ?? null,
          robotsHeader: [res.headers["x-robots-tag"] ?? ""].flat().join(", "),
          body: "",
        };
        if (!readBody || result.status !== 200) {
          res.resume();
          res.on("end", () => resolve(result));
          return;
        }
        const chunks = [];
        let size = 0;
        res.on("data", (chunk) => {
          size += chunk.length;
          if (size <= MAX_BODY_BYTES) chunks.push(chunk);
        });
        res.on("end", () => resolve({ ...result, body: Buffer.concat(chunks).toString("utf8") }));
      },
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.end();
  });
}

async function request(path, options) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const res = await requestOnce(path, options);
      if (res.status !== 429 && res.status < 500) return res;
      lastError = new Error(`HTTP ${res.status}`);
      if (attempt === MAX_ATTEMPTS) return res;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, attempt * 2_000));
  }
  throw new Error(`request failed for ${path}: ${lastError?.message ?? lastError}`);
}

async function mapConcurrent(items, concurrency, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

async function readJson(file, { optional = false } = {}) {
  if (optional && !existsSync(file)) return null;
  return JSON.parse(await readFile(file, "utf8"));
}

try {
  await requestOnce("/health/live", { readBody: false });
} catch (error) {
  console.error(
    `verify-legacy-redirects: ${baseUrl.origin} unreachable: ${error.message ?? error}`,
  );
  process.exit(2);
}

const inventory = await readJson(args.inventory);
const gold = await readJson(args.gold, { optional: true });
const { redirects } = await readJson(args.redirects);
const allTargets = buildVerificationTargets({ inventory, gold, redirects });
const targets = args.limit ? allTargets.slice(0, Number(args.limit)) : allTargets;
console.log(
  `verify-legacy-redirects: ${targets.length} URLs (${gold ? `${gold.entries.length} gold` : "no gold list"}) ` +
    `against ${baseUrl.origin}${hostOverride ? ` as ${hostOverride}` : ""}, destinations=${args.destinations}`,
);

const destinationChecks = new Map();
function verifyDestination(path) {
  if (!destinationChecks.has(path)) {
    destinationChecks.set(
      path,
      request(path, { readBody: true }).then((res) =>
        checkDestination(res, new URL(path, canonicalOrigin).toString(), {
          allowNoindex: args["allow-noindex"],
        }),
      ),
    );
  }
  return destinationChecks.get(path);
}

const wantsDestination = (target) =>
  args.destinations === "all" || (args.destinations === "gold" && target.sources.includes("gold"));

const results = await mapConcurrent(targets, Number(args.concurrency), async (target) => {
  try {
    const hop = await request(target.path, { readBody: false });
    const { outcome, issues } = checkRedirectHop(hop, target, canonicalOrigin);
    if (
      outcome !== "pass" ||
      target.expected.anotherProduct ||
      isExternalTarget(target.expected.path) ||
      !wantsDestination(target)
    ) {
      return { ...target, outcome, issues };
    }
    const destinationIssues = await verifyDestination(target.expected.path);
    if (destinationIssues.length === 0) return { ...target, outcome, issues };
    return {
      ...target,
      outcome: "fail",
      issues: destinationIssues.map((issue) => `${target.expected.path}: ${issue}`),
    };
  } catch (error) {
    return { ...target, outcome: "fail", issues: [String(error.message ?? error)] };
  }
});

const failures = results.filter((result) => result.outcome === "fail");
const retired = results.filter((result) => result.outcome === "retired");
const gaps = parityGaps(targets);
const report = {
  checkedAt: new Date().toISOString(),
  baseUrl: baseUrl.origin,
  host: hostOverride ?? null,
  canonicalOrigin,
  destinations: args.destinations,
  total: results.length,
  failed: failures.length,
  failures: failures.map(({ path, sources, expected, issues }) => ({
    path,
    sources,
    expected,
    issues,
  })),
  retired: retired.map(({ path, family }) => ({ path, family })),
  parityGaps: gaps,
};
await mkdir(dirname(args.report), { recursive: true });
await writeFile(args.report, `${JSON.stringify(report, null, 2)}\n`);

const goldFailures = failures.filter((result) => result.sources.includes("gold"));
const passed = results.length - failures.length - retired.length;
const goldSummary = gold ? `, gold failures ${goldFailures.length}` : "";
console.log(
  `verify-legacy-redirects: ${passed}/${results.length} passed, ${retired.length} retired (honest 404)${goldSummary}, parity gaps ${gaps.length} (report: ${args.report})`,
);
for (const item of retired.slice(0, 10)) console.log(`  RETIRED ${item.path} [${item.family}]`);
for (const failure of failures.slice(0, 40)) {
  console.log(
    `  FAIL ${failure.path} [${failure.sources.join(",")}]: ${failure.issues.join("; ")}`,
  );
}
if (failures.length > 40) console.log(`  … ${failures.length - 40} more in ${args.report}`);
process.exit(failures.length > 0 ? 1 : 0);
