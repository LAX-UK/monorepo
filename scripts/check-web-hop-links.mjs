#!/usr/bin/env node
/**
 * Bid account hops: nothing that uses the client router (`<Link>`, `<ButtonLink>`,
 * `router.push` / `router.replace`, `redirect()`) may reach /switch-account or /restore-account,
 * or open a page with `?account=`. The rule and the reason live in web-hop-link-rule.mjs.
 *
 * Not scanned: tests, and the route handlers themselves (`route.ts`), which answer the hop.
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { findHopViolations } from "./web-hop-link-rule.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const WEB_SRC = path.join(ROOT, "apps/web/src");

const isScanned = (name) =>
  /\.tsx?$/.test(name) && !/\.(test|spec)\.tsx?$/.test(name) && !/^route\.ts$/.test(name);

async function walk(dir, out = []) {
  for (const ent of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) await walk(full, out);
    else if (isScanned(ent.name)) out.push(full);
  }
  return out;
}

const violations = [];
for (const file of await walk(WEB_SRC)) {
  const rel = path.relative(WEB_SRC, file).split(path.sep).join("/");
  for (const { line, what } of findHopViolations(await readFile(file, "utf8"))) {
    violations.push(`${rel}:${line}  ${what}`);
  }
}

if (violations.length > 0) {
  console.error("Client-router navigation to an account hop:\n");
  for (const v of violations) console.error(`  ${v}`);
  console.error(
    "\nSwitch with useAccountSwitch (server action + page load). Where a hop must be opened as a" +
      " page, use a plain <a> or window.location.assign; a server page renders AccountRestoreHop.",
  );
  process.exit(1);
}
console.log("check-web-hop-links: ok");
