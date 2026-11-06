#!/usr/bin/env node
/**
 * Bid account hops: no router link (`<Link>`, `<ButtonLink>`) may point at /switch-account or
 * /restore-account. The rule and the reason live in web-hop-link-rule.mjs.
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { findHopLinks } from "./web-hop-link-rule.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const WEB_SRC = path.join(ROOT, "apps/web/src");

async function walk(dir, out = []) {
  for (const ent of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) await walk(full, out);
    else if (/\.tsx$/.test(ent.name) && !/\.(test|spec)\.tsx$/.test(ent.name)) out.push(full);
  }
  return out;
}

const violations = [];
for (const file of await walk(WEB_SRC)) {
  const rel = path.relative(WEB_SRC, file).split(path.sep).join("/");
  for (const line of findHopLinks(await readFile(file, "utf8"))) {
    violations.push(`${rel}:${line}`);
  }
}

if (violations.length > 0) {
  console.error("Router links to an account hop:\n");
  for (const v of violations) console.error(`  ${v}`);
  console.error(
    "\nSwitch with useAccountSwitch (server action + page load). Where a hop must be opened as a" +
      " page, use a plain <a>.",
  );
  process.exit(1);
}
console.log("check-web-hop-links: ok");
