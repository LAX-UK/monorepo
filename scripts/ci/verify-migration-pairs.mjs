#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const drizzleDir = join(repoRoot, "packages/db/drizzle");

export const MIGRATION_PAIR_TAGS = [
  "0137_user_category_interests",
  "0138_buyer_interest_categories",
  "0141_identity_boundary_clients",
  "0142_identity_lifecycle",
  "0144_repair_sale_hero_presentation",
  "0145_bid_identity_lifecycle_projection",
  "0146_oauth_consent_client_user_unique",
  "0147_oidc_rp_sessions",
  "0148_oidc_logout_and_shop_sessions",
  "0149_ssf_signal_transport",
  "0150_remove_shop_session_id_token",
  "0151_identity_lifecycle_outbox",
  "0152_ssf_drop_domain_events_fk",
  "0153_contract_user_identity_only",
  "0154_subject_id_expand",
  "0155_ssf_reset_outbox_checkpoint",
  "0157_revoke_auth_email_pipeline",
  "0158_revoke_auth_product_reads",
  "0159_bid_identity_directory",
  "0160_revoke_worker_user_reads",
  "0161_revoke_api_user_reads",
];

export const MIGRATION_PAIR_EXCLUSIONS = {
  "0139_complete_buyer_interest_categories":
    "rollback is intentionally non-destructive because the shared catalog rows may already be referenced",
  "0140_identity_boundary_profiles":
    "rollback cannot drop bid_user_profile after 0153 moves the user_category_interest foreign key to it",
  "0143_bid_profile_authoritative":
    "forward SQL requires legacy public.user Bid columns removed by 0153",
  "0156_repair_user_pii_purge":
    "rollback restores a function body that references public.user columns removed by 0153; PostgreSQL defers validating that body, so a generic pair probe would be a false positive",
};

function migrationTagsInScope() {
  const journal = JSON.parse(readFileSync(join(drizzleDir, "meta/_journal.json"), "utf8"));
  return journal.entries
    .map((entry) => entry.tag)
    .filter((tag) => {
      const version = Number(tag.slice(0, 4));
      return version >= 137 && version <= 161;
    });
}

function auditMatrix() {
  const registered = migrationTagsInScope();
  const accountedFor = [...MIGRATION_PAIR_TAGS, ...Object.keys(MIGRATION_PAIR_EXCLUSIONS)];
  const duplicates = accountedFor.filter((tag, index) => accountedFor.indexOf(tag) !== index);
  const missing = registered.filter((tag) => !accountedFor.includes(tag));
  const unknown = accountedFor.filter((tag) => !registered.includes(tag));

  if (duplicates.length > 0 || missing.length > 0 || unknown.length > 0) {
    throw new Error(
      [
        "Identity migration-pair matrix does not match the journal.",
        duplicates.length > 0 ? `Duplicate: ${duplicates.join(", ")}` : "",
        missing.length > 0 ? `Missing: ${missing.join(", ")}` : "",
        unknown.length > 0 ? `Unknown: ${unknown.join(", ")}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }
}

function printMatrix() {
  console.log("Executable migration pairs:");
  for (const tag of MIGRATION_PAIR_TAGS) console.log(`  ${tag}`);
  console.log("Explicit exclusions:");
  for (const [tag, reason] of Object.entries(MIGRATION_PAIR_EXCLUSIONS)) {
    console.log(`  ${tag}: ${reason}`);
  }
  console.log("Coverage limitation:");
  console.log(
    "  Pair probes prove rollback and forward SQL execute transactionally; they do not prove data equivalence. In particular, 0155 intentionally cannot restore deleted deliveries or detached source ids.",
  );
}

function verifyPair(tag) {
  const result = spawnSync("pnpm", ["--filter", "@auction/db", "db:verify-migration-pair", tag], {
    cwd: repoRoot,
    env: process.env,
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

auditMatrix();

if (process.argv.includes("--list")) {
  printMatrix();
} else {
  if (!process.env.MIGRATION_TEST_DATABASE_URL) {
    throw new Error("MIGRATION_TEST_DATABASE_URL is required to verify migration pairs");
  }
  for (const tag of MIGRATION_PAIR_TAGS) verifyPair(tag);
  console.log(`Verified ${MIGRATION_PAIR_TAGS.length} executable migration pairs.`);
  printMatrix();
}
