#!/usr/bin/env node
/**
 * CI check after `next build`: the lax.art pages that must be prerendered still are (the home page
 * served to every document request for `/`). Fails when one became dynamic, which happens as soon
 * as anything in its render reads cookies, headers or the session.
 *
 *   node apps/art/scripts/check-prerendered-routes.mjs                 # fails when not built
 *   node apps/art/scripts/check-prerendered-routes.mjs --skip-unbuilt  # for --affected builds
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { REQUIRED_PRERENDERED_ROUTES, findPrerenderProblems } from "./prerendered-output.mjs";

const manifestPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  ".next",
  "prerender-manifest.json",
);

if (!existsSync(manifestPath)) {
  if (process.argv.includes("--skip-unbuilt")) {
    console.log("check-prerendered-routes: lax.art was not built in this run; skipped.");
    process.exit(0);
  }
  console.error(
    `check-prerendered-routes: ${manifestPath} is missing; run the lax.art build first.`,
  );
  process.exit(1);
}

const problems = findPrerenderProblems(JSON.parse(readFileSync(manifestPath, "utf8")));
if (problems.length > 0) {
  for (const problem of problems) console.error(`check-prerendered-routes: ${problem}`);
  process.exit(1);
}
console.log(
  `check-prerendered-routes: prerendered as required: ${REQUIRED_PRERENDERED_ROUTES.join(", ")}`,
);
