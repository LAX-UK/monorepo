#!/usr/bin/env node
import { spawnSync } from "node:child_process";
/**
 * Proves acceptance teardown removes bid_identity_directory rows for run-scoped users.
 * Requires owner DATABASE_URL and a migrated database (identity preflight disposable DB).
 */
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pg from "pg";
import { buildPgConnectionConfig } from "../../packages/identity-db/src/pg/ssl.ts";

const connectionString = process.env.DATABASE_URL_OWNER ?? process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL_OWNER or DATABASE_URL is required");
}

const subjectId = `acceptance-cleanup-${process.pid}`;
const email = `probe+lax-cleanup-regression-${process.pid}@example.test`;
const manifestDir = mkdtempSync(join(tmpdir(), "acceptance-cleanup-"));
const manifestPath = join(manifestDir, "manifest.json");
writeFileSync(
  manifestPath,
  `${JSON.stringify({ runId: String(process.pid), emails: [email], createdAt: new Date().toISOString() }, null, 2)}\n`,
);

const client = new pg.Client(buildPgConnectionConfig(connectionString));
await client.connect();
try {
  await client.query("begin");
  await client.query(
    `insert into public."user" (id, email, name, email_verified, created_at, updated_at)
     values ($1, $2, $3, true, now(), now())`,
    [subjectId, email, "Acceptance cleanup regression"],
  );
  await client.query(
    `insert into public.bid_identity_directory (
       subject_id, email, name, email_verified, identity_created_at, replicated_at, last_event_id
     ) values ($1, $2, $3, true, now(), now(), 0)`,
    [subjectId, email, "Acceptance cleanup regression"],
  );
  await client.query("commit");
} catch (error) {
  await client.query("rollback").catch(() => undefined);
  throw error;
} finally {
  await client.end();
}

const cleanup = spawnSync("pnpm", ["tsx", "scripts/ci/cleanup-identity-acceptance-users.mjs"], {
  env: {
    ...process.env,
    DATABASE_URL_OWNER: connectionString,
    ACCEPTANCE_MANIFEST_PATH: manifestPath,
  },
  stdio: "inherit",
});
if (cleanup.status !== 0) {
  throw new Error("acceptance cleanup regression failed");
}

const drift = spawnSync("pnpm", ["tsx", "scripts/ci/verify-identity-directory-drift.mjs"], {
  env: { ...process.env, DATABASE_URL_OWNER: connectionString },
  stdio: "inherit",
});
if (drift.status !== 0) {
  throw new Error("directory drift after acceptance cleanup regression");
}

console.log("acceptance cleanup directory regression passed");
