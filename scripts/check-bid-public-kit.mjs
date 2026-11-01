#!/usr/bin/env node
/**
 * Bid public-site kit guard: the public folders build on `@auction/ui/lax`, not the older Button,
 * Badge, Alert, Tabs and Input. The older Button is gone from these folders and may not return.
 * Badge, Alert, Tabs and Input still have callers waiting for their own migration; they are listed
 * in bid-public-kit-allowlist.json, which can only shrink: a new use fails, and so does an entry
 * whose file no longer needs it (remove it). The rule itself lives in bid-public-kit-rule.mjs.
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { OLDER_ELEMENTS, olderElementsImported } from "./bid-public-kit-rule.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const WEB_SRC = path.join(ROOT, "apps/web/src");
const ALLOWLIST = JSON.parse(
  await readFile(path.join(import.meta.dirname, "bid-public-kit-allowlist.json"), "utf8"),
);

async function walk(dir, out = []) {
  for (const ent of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) await walk(full, out);
    else if (/\.tsx?$/.test(ent.name)) out.push(full);
  }
  return out;
}

const used = new Set();
for (const file of await walk(WEB_SRC)) {
  const rel = path.relative(WEB_SRC, file).split(path.sep).join("/");
  for (const element of olderElementsImported(rel, await readFile(file, "utf8"))) {
    used.add(`${rel}::${element}`);
  }
}

const allowed = new Set(ALLOWLIST.entries);
const violations = [];
for (const key of used) {
  if (allowed.has(key)) continue;
  const [rel, element] = key.split("::");
  violations.push(`${rel}: imports the older ${element} — use ${OLDER_ELEMENTS[element]}`);
}
for (const key of allowed) {
  if (!used.has(key))
    violations.push(`${key}: no longer needed — remove it from bid-public-kit-allowlist.json`);
}

if (violations.length > 0) {
  console.error("error: Bid public-site kit violations:\n");
  for (const v of violations.sort()) console.error(`  ${v}`);
  process.exit(1);
}
console.log(`bid public kit: ok (${allowed.size} older-element imports left to migrate)`);
