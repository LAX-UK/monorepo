#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const contract = JSON.parse(readFileSync(join(root, "schema-contract.json"), "utf8"));
const failures = [];

if (!/^[0-9a-f]{40}$/.test(contract.monorepoCommit ?? "")) {
  failures.push("monorepoCommit must be a lowercase 40-character Git SHA");
}
if (!/^\d{4}_[a-z0-9_]+$/.test(contract.migrationJournal?.tip ?? "")) {
  failures.push("migrationJournal.tip must be an immutable migration name");
}
if (!/^[0-9a-f]{64}$/.test(contract.migrationJournal?.sha256 ?? "")) {
  failures.push("migrationJournal.sha256 must be a lowercase SHA-256 digest");
}
if (
  !/^registry\.digitalocean\.com\/lax-bid\/lax-test-migrate@sha256:[0-9a-f]{64}$/.test(
    contract.migrateImage ?? "",
  )
) {
  failures.push("migrateImage must use the approved repository and an immutable digest");
}

if (failures.length > 0) {
  console.error(`Invalid schema-contract.json:\n${failures.map((item) => `  ${item}`).join("\n")}`);
  process.exit(1);
}

if (process.argv.includes("--print-migrate-image")) {
  process.stdout.write(contract.migrateImage);
} else {
  console.log(
    `schema-contract: ok (${contract.migrationJournal.tip}, ${contract.migrateImage.split("@")[1]})`,
  );
}
