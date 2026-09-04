#!/usr/bin/env node
/**
 * Static verification of documented database-split exit criteria from
 * docs/architecture/09-lax-identity-boundary.md.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

const EXIT_CRITERIA_MIGRATIONS = [
  "0153_contract_user_identity_only",
  "0154_subject_id_expand",
  "0159_bid_identity_directory",
  "0160_revoke_worker_user_reads",
  "0161_revoke_api_user_reads",
];

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
  "categoryInterestsOnboardingCompletedAt",
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
  const migration = read("packages/db/drizzle/0153_contract_user_identity_only.sql");
  if (/CREATE TRIGGER bid_profile_legacy_user_sync/i.test(migration)) {
    throw new Error("0153 must drop 0143 compatibility triggers, not recreate them");
  }
  if (!/DROP FUNCTION IF EXISTS public\.sync_bid_profile_legacy_user/i.test(migration)) {
    throw new Error("0153 must drop sync_bid_profile_legacy_user");
  }
  for (const column of [
    "first_name",
    "role",
    "kyc_status",
    "mobile",
    "category_interests_onboarding_completed_at",
  ]) {
    if (!new RegExp(`DROP COLUMN IF EXISTS "${column}"`, "i").test(migration)) {
      throw new Error(`0153 must drop user.${column}`);
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
  const migration = read("packages/db/drizzle/0154_subject_id_expand.sql");
  if (!/ALTER TABLE public\.bid[\s\S]*subject_id/i.test(migration)) {
    throw new Error("0154 must expand bid.subject_id");
  }
  if (!/bid_subject_id_user_fk/i.test(migration)) {
    throw new Error("0154 must add optional NOT VALID subject FK");
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
  if (/\buser\./.test(persistenceProfile) || /\.from\(user\)/.test(persistenceProfile)) {
    throw new Error("drizzle-profile.repository still reads Identity user");
  }

  const workerMarketing = read(
    "apps/worker/src/repositories/drizzle-marketing-contact-sync.repository.ts",
  );
  if (/user\.role/.test(workerMarketing) || /user\.firstName/.test(workerMarketing)) {
    throw new Error("worker marketing sync still reads bid columns from user");
  }

  const roles = read("packages/db/src/migrate-roles.ts");
  if (/API_READ_TABLES\s*=\s*\[[^\]]*["']user["']/.test(roles)) {
    throw new Error("api_app still has user in API_READ_TABLES");
  }
  if (!/API_DENY_TABLES\s*=\s*\[[^\]]*["']user["']/.test(roles)) {
    throw new Error("api_app must deny user by default after the 0161 cutover");
  }
  if (
    !/restoreApiUserSelect[\s\S]*hasTablePrivilege[\s\S]*restoreApiUserSelect[\s\S]*grantIfExists\(\s*client,\s*["']api_app["'],\s*["']user["'],\s*["']SELECT["']/m.test(
      roles,
    )
  ) {
    throw new Error("migrate-roles must preserve only an existing api_app user SELECT grant");
  }
}

function verifyDirectoryCutoverMigrations() {
  const create = read("packages/db/drizzle/0159_bid_identity_directory.sql");
  if (
    !/FROM "user" AS u/i.test(create) ||
    !/GRANT SELECT[\s\S]*bid_identity_directory TO api_app/i.test(create)
  ) {
    throw new Error("0159 must backfill and grant the Bid Identity directory");
  }
  const workerRevoke = read("packages/db/drizzle/0160_revoke_worker_user_reads.sql");
  if (!/REVOKE SELECT ON TABLE public\."user" FROM worker_app/i.test(workerRevoke)) {
    throw new Error("0160 must revoke worker_app user SELECT");
  }
  const apiRevoke = read("packages/db/drizzle/0161_revoke_api_user_reads.sql");
  if (!/REVOKE SELECT ON TABLE public\."user" FROM api_app/i.test(apiRevoke)) {
    throw new Error("0161 must revoke api_app user SELECT");
  }
}

function listTypeScriptFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return listTypeScriptFiles(path);
    return entry.isFile() && /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

function verifyApiTestImports() {
  const root = "apps/api/src";
  const violations = [];
  for (const path of listTypeScriptFiles(root)) {
    if (!/\.(?:test|spec|integration\.test)\.(?:ts|tsx)$/.test(path)) continue;
    const source = read(path);
    for (const match of source.matchAll(
      /import\s+(?:type\s+)?\{([\s\S]*?)\}\s+from\s+["']@auction\/db\/schema["']/g,
    )) {
      const imports = (match[1] ?? "").split(",").map((name) => name.trim().split(/\s+as\s+/)[0]);
      if (imports.includes("user")) violations.push(relative(".", path));
    }
  }
  if (violations.length > 0) {
    throw new Error(`API tests import Identity-owned user directly: ${violations.join(", ")}`);
  }
}

function main() {
  verifyMigrationRegistry();
  verifyPhase5ContractUser();
  verifyPhase6SubjectExpand();
  verifyDirectoryCutoverMigrations();
  verifyProductReaders();
  verifyApiTestImports();
  console.log("identity exit criteria verification passed (static)");
}

main();
