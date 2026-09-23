#!/usr/bin/env node
/**
 * Ensures test ephemeral Terraform applies the full migration journal for Shop,
 * while production keeps staged migrate-prod ceilings.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const journalPath = resolve(repoRoot, "packages/db/drizzle/meta/_journal.json");
const testMain =
  process.argv[2] ?? resolve(repoRoot, "../auction-infra/terraform/ephemeral/test/main.tf");
const prodMain =
  process.argv[3] ?? resolve(repoRoot, "../auction-infra/terraform/ephemeral/prod/main.tf");

const testTf = readFileSync(testMain, "utf8");
const prodTf = readFileSync(prodMain, "utf8");
const journal = JSON.parse(readFileSync(journalPath, "utf8"));

const violations = [];

if (!/node packages\/db\/dist\/migrate\.js/.test(testTf)) {
  violations.push("test migrate job must run packages/db/dist/migrate.js for full Shop schema");
}
if (/node packages\/db\/dist\/migrate-prod\.js/.test(testTf)) {
  violations.push(
    "test migrate job must not use migrate-prod.js (0159 ceiling blocks Shop commerce)",
  );
}
if (!/key = "DATABASE_URL"/.test(testTf)) {
  violations.push("test migrate job must set DATABASE_URL for migrate.js");
}
if (!/node packages\/db\/dist\/migrate-prod\.js/.test(prodTf)) {
  violations.push("production migrate job must keep migrate-prod.js staged ceilings");
}
if (/node packages\/db\/dist\/migrate\.js/.test(prodTf)) {
  violations.push("production migrate job must not run unconstrained migrate.js");
}

const shopCommerceTag = journal.entries.find((entry) =>
  String(entry.tag).startsWith("0166_shop_commerce"),
);
if (!shopCommerceTag) {
  violations.push("journal must include 0166_shop_commerce for shop-api readiness");
}

if (violations.length > 0) {
  console.error("Staging migrate contract violations:\n");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log("staging migrate contract: ok (test full journal, prod migrate-prod ceiling)");
