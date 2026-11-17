#!/usr/bin/env node
/**
 * Runs after `next build`. lax.art's data (shop-api, the editorial service) is not reachable while
 * an image is built, so the HTML Next prerendered then shows failed reads and build-time settings
 * (localhost links, no analytics). This removes it, so each prerendered page renders on its first
 * request with the running app's data and settings, and is cached and regenerated from there on.
 * Fails when a prerendered route's files are not where this expects them (a Next upgrade moved
 * them), so build-time HTML can never be served unnoticed.
 */
import { existsSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  REQUIRED_PRERENDERED_ROUTES,
  prerenderedFileBase,
  prerenderedRoutes,
} from "./prerendered-output.mjs";

/** Pages whose HTML must be where this expects it; a miss means a Next upgrade moved it. */
const HTML_ROUTES = new Set([...REQUIRED_PRERENDERED_ROUTES, "/_not-found"]);

const appDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const nextDir = join(appDir, ".next");
const manifest = JSON.parse(readFileSync(join(nextDir, "prerender-manifest.json"), "utf8"));

// The build's own output, and the copy `output: "standalone"` made of it for the image.
const outputs = [
  join(nextDir, "server", "app"),
  join(nextDir, "standalone", "apps", "art", ".next", "server", "app"),
].filter((dir) => existsSync(dir));

let failed = false;
for (const route of prerenderedRoutes(manifest)) {
  const base = prerenderedFileBase(route);
  for (const dir of outputs) {
    if (!existsSync(join(dir, `${base}.html`))) {
      // Another static route without HTML (a route handler such as robots.txt writes `.body`)
      // has no page to drop; only the pages above must be found.
      if (!HTML_ROUTES.has(route)) {
        console.log(`drop-build-time-html: ${route} has no HTML in ${dir}; left as built`);
        continue;
      }
      console.error(`drop-build-time-html: no ${base}.html in ${dir} for ${route}`);
      failed = true;
      continue;
    }
    for (const suffix of [".html", ".rsc", ".meta", ".segments"]) {
      rmSync(join(dir, `${base}${suffix}`), { recursive: true, force: true });
    }
  }
  console.log(`drop-build-time-html: ${route} renders on its first request`);
}
process.exit(failed ? 1 : 0);
