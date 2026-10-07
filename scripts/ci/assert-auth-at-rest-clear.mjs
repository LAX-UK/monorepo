#!/usr/bin/env node
/**
 * Fail when auth-at-rest inventory reports pending rows (auth image refuses to start).
 * Requires DATABASE_URL_AUTH (or owner) and built @auction/db backfill script.
 */
import { spawnSync } from "node:child_process";

const script = "packages/db/dist/scripts/backfill-auth-at-rest.js";
const result = spawnSync("node", [script], {
  encoding: "utf8",
  env: process.env,
});

if (result.status !== 0) {
  console.error(result.stderr || result.stdout);
  process.exit(result.status ?? 1);
}

const line = result.stdout.trim().split("\n").pop() ?? "";
let counts;
try {
  counts = JSON.parse(line);
} catch {
  console.error("::error::Could not parse auth-at-rest inventory output");
  process.exit(1);
}

const total = Number(counts.total ?? 0);
if (total > 0) {
  console.error(
    `::error::Auth at-rest has ${total} pending row(s) (${JSON.stringify(counts)}). Run Auth at-rest maintenance (test) with mode=apply and confirm_backup=true before deploy.`,
  );
  process.exit(1);
}

console.log("auth-at-rest inventory clear");
