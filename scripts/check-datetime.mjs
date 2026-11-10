#!/usr/bin/env node
/**
 * Date and time guard: formatting a moment and zone arithmetic live in `@auction/datetime`.
 * Files that still do it themselves are listed in datetime-baseline.json, which can only shrink: a
 * new file fails, and so does a listed file that no longer needs its entry (remove it). When the
 * last stage of the migration lands the baseline is empty and this becomes a plain error.
 * `--write-baseline` rewrites the list from the current tree. The rule lives in datetime-rule.mjs.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { BANNED, bannedConstructsIn } from "./datetime-rule.mjs";
import { listSourceFiles } from "./identity/import-specifiers.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const BASELINE_FILE = path.join(import.meta.dirname, "datetime-baseline.json");
const WORKSPACE_ROOTS = ["apps", "packages"];

async function scan() {
  const found = new Map();
  for (const group of WORKSPACE_ROOTS) {
    for (const file of listSourceFiles(path.join(ROOT, group), { includeTests: false })) {
      const rel = path.relative(ROOT, file).split(path.sep).join("/");
      const constructs = bannedConstructsIn(rel, await readFile(file, "utf8"));
      if (constructs.length > 0) found.set(rel, constructs);
    }
  }
  return found;
}

const found = await scan();

if (process.argv.includes("--write-baseline")) {
  const files = [...found.keys()].sort();
  await writeFile(BASELINE_FILE, `${JSON.stringify({ files }, null, 2)}\n`);
  console.log(`datetime: wrote ${files.length} files to the baseline`);
  process.exit(0);
}

const baseline = new Set(JSON.parse(await readFile(BASELINE_FILE, "utf8")).files);
const violations = [];
for (const [rel, constructs] of found) {
  if (!baseline.has(rel)) {
    violations.push(
      `${rel}: uses ${constructs.join(", ")} — format and compute dates with @auction/datetime`,
    );
  }
}
for (const rel of baseline) {
  if (!found.has(rel)) {
    violations.push(
      `${rel}: no longer needs its baseline entry — remove it from datetime-baseline.json`,
    );
  }
}

if (violations.length > 0) {
  console.error("error: date and time code outside @auction/datetime:\n");
  for (const v of violations.sort()) console.error(`  ${v}`);
  console.error(`\nBanned: ${Object.keys(BANNED).join(", ")}`);
  process.exit(1);
}
console.log(`datetime: ok (${baseline.size} files still to move onto @auction/datetime)`);
