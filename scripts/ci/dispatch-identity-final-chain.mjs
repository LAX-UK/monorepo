#!/usr/bin/env node
/**
 * Dispatches the reviewed staging recovery chain with accepted image contracts.
 * Requires gh CLI and repository maintainer permissions.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const required = [
  "IDENTITY_SHA",
  "IDENTITY_DIGEST",
  "SHOP_IDENTITY_SHA",
  "SHOP_IDENTITY_DIGEST",
  "SHOP_SHA",
  "SHOP_DIGEST",
  "SHOP_API_SHA",
  "SHOP_API_DIGEST",
  "INFRA_SHA",
  "PUBLISH_RUN_ID",
];

for (const name of required) {
  if (!process.env[name]) {
    throw new Error(`${name} is required`);
  }
}

const gitHead = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" });
if (gitHead.status !== 0) throw new Error("Unable to resolve the monorepo HEAD");
const monorepoSha = process.env.MONOREPO_SHA ?? gitHead.stdout.trim();
const migrationJournalSha = createHash("sha256")
  .update(readFileSync("packages/db/drizzle/meta/_journal.json"))
  .digest("hex");

const rollbackManifest = JSON.stringify({
  version: 1,
  repository: "LAX-UK/monorepo",
  monorepoSha,
  infraSha: process.env.INFRA_SHA,
  migrationJournal: {
    tip: "0161_revoke_api_user_reads",
    sha256: process.env.MIGRATION_JOURNAL_SHA256 ?? migrationJournalSha,
  },
  dataContractVersion: "identity-v1",
  enableAuthSsfDelivery: true,
  identity: {
    sha: process.env.QUALIFIED_ROLLBACK_SHA ?? "933c947faa922ebb7374db2aea9b09d7ba0b344c",
    digest:
      process.env.QUALIFIED_ROLLBACK_DIGEST ??
      "sha256:2e23cf9d0b075e7645774ca2f8c229935ae4fa55138a33d1eaa184c2768e35a4",
    buildRun: process.env.QUALIFIED_ROLLBACK_BUILD_RUN ?? "0",
  },
  shopIdentity: {
    sha: process.env.SHOP_IDENTITY_SHA,
    digest: process.env.SHOP_IDENTITY_DIGEST,
    buildRun: process.env.SHOP_IDENTITY_BUILD_RUN ?? "0",
  },
  shop: {
    sha: process.env.SHOP_SHA,
    digest: process.env.SHOP_DIGEST,
    buildRun: process.env.SHOP_BUILD_RUN ?? "0",
  },
  shopApi: {
    sha: process.env.SHOP_API_SHA,
    digest: process.env.SHOP_API_DIGEST,
    buildRun: process.env.SHOP_API_BUILD_RUN ?? "0",
  },
});

const args = [
  "workflow",
  "run",
  "staging-recovery-test.yml",
  "--ref",
  process.env.GITHUB_REF ?? "main",
  "-f",
  `identity_sha=${process.env.IDENTITY_SHA}`,
  "-f",
  `identity_digest=${process.env.IDENTITY_DIGEST}`,
  "-f",
  `shop_identity_sha=${process.env.SHOP_IDENTITY_SHA}`,
  "-f",
  `shop_identity_digest=${process.env.SHOP_IDENTITY_DIGEST}`,
  "-f",
  `shop_image=${process.env.SHOP_SHA}@${process.env.SHOP_DIGEST}`,
  "-f",
  `shop_api_image=${process.env.SHOP_API_SHA}@${process.env.SHOP_API_DIGEST}`,
  "-f",
  `publish_run_id=${process.env.PUBLISH_RUN_ID}`,
  "-f",
  "run_acceptance=true",
  "-f",
  "rollback_rehearsal=true",
  "-f",
  `rollback_manifest=${rollbackManifest}`,
];

const result = spawnSync("gh", args, { stdio: "inherit" });
if (result.status !== 0) process.exit(result.status ?? 1);

console.log("Dispatched staging recovery final chain.");
