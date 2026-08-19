#!/usr/bin/env node
/**
 * Static verification of documented database-split exit criteria from
 * docs/architecture/09-lax-identity-boundary.md.
 */
import { readFileSync } from "node:fs";

const EXIT_CRITERIA_MIGRATIONS = ["0150_contract_user_identity_only", "0151_subject_id_expand"];

const BID_OWNED_USER_COLUMNS = [
  "firstName",
  "lastName",
  "mobile",
  "mobileCountry",
  "role",
  "staffRole",
  "emailStatus",
  "emailStatusChangedAt",
  "suspendedAt",
  "suspendedReason",
  "kycStatus",
  "currentKycSessionId",
  "kycRetryCount",
  "kycVerifiedAt",
  "preferredPaddleNumber",
  "amlHoldStatus",
  "amlHoldReason",
  "amlHoldAt",
  "signupPersona",
  "dateOfBirth",
  "hasSeenActingContextTooltip",
];

function read(path) {
  return readFileSync(path, "utf8");
}

function verifyMigrationRegistry() {
  const journal = JSON.parse(read("packages/db/drizzle/meta/_journal.json"));
  const tags = new Set(journal.entries.map((entry) => entry.tag));
  for (const tag of EXIT_CRITERIA_MIGRATIONS) {
    if (!tags.has(tag)) throw new Error(`migration registry is missing ${tag}`);
    const version = tag.slice(0, 4);
    read(`packages/db/drizzle/${tag}.sql`);
    read(`packages/db/drizzle/${version}_rollback.sql`);
  }
}

function verifyPhase5ContractUser() {
  const migration = read("packages/db/drizzle/0150_contract_user_identity_only.sql");
  if (/CREATE TRIGGER bid_profile_legacy_user_sync/i.test(migration)) {
    throw new Error("0150 must drop 0140 compatibility triggers, not recreate them");
  }
  if (!/DROP FUNCTION IF EXISTS public\.sync_bid_profile_legacy_user/i.test(migration)) {
    throw new Error("0150 must drop sync_bid_profile_legacy_user");
  }
  for (const column of ["first_name", "role", "kyc_status", "mobile"]) {
    if (!new RegExp(`DROP COLUMN IF EXISTS "${column}"`, "i").test(migration)) {
      throw new Error(`0150 must drop user.${column}`);
    }
  }

  const authSchema = read("packages/identity-db/src/schema/auth.ts");
  for (const column of BID_OWNED_USER_COLUMNS) {
    if (new RegExp(`\\b${column}:`).test(authSchema)) {
      throw new Error(`identity user schema still declares bid-owned column ${column}`);
    }
  }

  const reconcile = read("packages/db/src/scripts/reconcile-identity-profile-drift.ts");
  if (/u\.role IS DISTINCT FROM/i.test(reconcile)) {
    throw new Error("reconcile script still compares legacy user bid columns");
  }
}

function verifyPhase6SubjectExpand() {
  const migration = read("packages/db/drizzle/0151_subject_id_expand.sql");
  if (!/ALTER TABLE public\.bid[\s\S]*subject_id/i.test(migration)) {
    throw new Error("0151 must expand bid.subject_id");
  }
  if (!/bid_subject_id_user_fk/i.test(migration)) {
    throw new Error("0151 must add optional NOT VALID subject FK");
  }

  const bidsSchema = read("packages/db/src/schema/bids.ts");
  if (!/\bsubjectId:/.test(bidsSchema)) {
    throw new Error("bid drizzle schema must declare subjectId");
  }

  read("docs/scripts/identity/fk-removal-inventory.mjs");
}

function verifyProductReaders() {
  const persistenceProfile = read(
    "packages/persistence/src/repositories/drizzle-profile.repository.ts",
  );
  if (/user\.role/.test(persistenceProfile) || /user\.kycStatus/.test(persistenceProfile)) {
    throw new Error("drizzle-profile.repository still reads bid columns from user");
  }

  const workerMarketing = read(
    "apps/worker/src/repositories/drizzle-marketing-contact-sync.repository.ts",
  );
  if (/user\.role/.test(workerMarketing) || /user\.firstName/.test(workerMarketing)) {
    throw new Error("worker marketing sync still reads bid columns from user");
  }
}

function main() {
  verifyMigrationRegistry();
  verifyPhase5ContractUser();
  verifyPhase6SubjectExpand();
  verifyProductReaders();
  console.log("identity exit criteria verification passed (static)");
}

main();
