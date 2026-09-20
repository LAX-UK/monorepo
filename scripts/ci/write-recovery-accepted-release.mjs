#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseRecoveryManifest } from "./identity-recovery/manifest.mjs";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function component(name) {
  return {
    sha: requireEnv(`${name}_SHA`),
    digest: requireEnv(`${name}_DIGEST`),
    buildRun: requireEnv(`${name}_BUILD_RUN`),
  };
}

const migrationJournalSha256 = createHash("sha256")
  .update(readFileSync(resolve(root, "packages/db/drizzle/meta/_journal.json")))
  .digest("hex");

const manifest = {
  version: 1,
  repository: "LAX-UK/monorepo",
  monorepoSha: requireEnv("MONOREPO_SHA"),
  infraSha: requireEnv("INFRA_SHA"),
  migrationJournal: {
    tip: "0161_revoke_api_user_reads",
    sha256: migrationJournalSha256,
  },
  dataContractVersion: "identity-v1",
  enableAuthSsfDelivery: true,
  identity: component("IDENTITY"),
  shopIdentity: component("SHOP_IDENTITY"),
  shop: component("SHOP"),
  shopApi: component("SHOP_API"),
};

const serialized = JSON.stringify(manifest);
parseRecoveryManifest(serialized);

const outputPath = process.env.RECOVERY_ACCEPTED_RELEASE_PATH ?? "accepted-release.json";
mkdirSync(dirname(resolve(outputPath)), { recursive: true });
writeFileSync(outputPath, `${serialized}\n`);
console.log(`Wrote validated recovery accepted release to ${outputPath}`);
