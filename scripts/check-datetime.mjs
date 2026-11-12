#!/usr/bin/env node
/**
 * Date and time guard: formatting a moment and zone arithmetic live in `@auction/datetime`. Any
 * production file under apps/ or packages/ that builds its own date formatter, calls
 * toLocaleDateString/toLocaleTimeString (or toLocaleString on a date), or imports @date-fns/tz
 * fails. The rule, and its one exemption (the self-contained Identity closure), live in
 * datetime-rule.mjs.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { BANNED, bannedConstructsIn } from "./datetime-rule.mjs";
import { listSourceFiles } from "./identity/import-specifiers.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const WORKSPACE_ROOTS = ["apps", "packages"];

const violations = [];
for (const group of WORKSPACE_ROOTS) {
  for (const file of listSourceFiles(path.join(ROOT, group), { includeTests: false })) {
    const rel = path.relative(ROOT, file).split(path.sep).join("/");
    const constructs = bannedConstructsIn(rel, await readFile(file, "utf8"));
    if (constructs.length > 0) {
      violations.push(
        `${rel}: uses ${constructs.join(", ")} — format and compute dates with @auction/datetime`,
      );
    }
  }
}

if (violations.length > 0) {
  console.error("error: date and time code outside @auction/datetime:\n");
  for (const v of violations.sort()) console.error(`  ${v}`);
  console.error(`\nBanned: ${Object.keys(BANNED).join(", ")}`);
  process.exit(1);
}
console.log("datetime: ok");
