#!/usr/bin/env node
/**
 * Report-only FK removal inventory gate for CI migration cells.
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const inventory = join(repoRoot, "docs/scripts/identity/fk-removal-inventory.mjs");

const result = spawnSync("node", [inventory], { cwd: repoRoot, stdio: "inherit" });
if (result.status !== 0) process.exit(result.status ?? 1);
console.log("FK removal inventory gate passed (report-only).");
