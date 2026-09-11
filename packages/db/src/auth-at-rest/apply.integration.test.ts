import { randomUUID } from "node:crypto";
import { createEnvelopeCrypto, parseAuthDekKey } from "@auction/identity-contracts";
import { hasAuthAtRestPending, totalAuthAtRestPending } from "@auction/identity-db";
import pg from "pg";
import { describe, expect, it } from "vitest";
import { buildPgConnectionConfig } from "../ssl.js";
import {
  type AuthAtRestBatchProgress,
  applyAuthAtRestBackfill,
  inventoryAuthAtRest,
  verifyAuthAtRestComplete,
} from "./apply.js";

const migrationUrl = process.env.MIGRATION_TEST_DATABASE_URL;

async function withAuthDatabase(run: (pool: pg.Pool) => Promise<void>): Promise<void> {
  if (!migrationUrl) throw new Error("MIGRATION_TEST_DATABASE_URL is required");
  const databaseName = `auth_at_rest_${randomUUID().replaceAll("-", "")}`;
  const adminUrl = new URL(migrationUrl);
  adminUrl.pathname = "/postgres";
  const databaseUrl = new URL(migrationUrl);
  databaseUrl.pathname = `/${databaseName}`;
  const admin = new pg.Client(buildPgConnectionConfig(adminUrl.toString()));
  await admin.connect();
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  const pool = new pg.Pool(buildPgConnectionConfig(databaseUrl.toString()));
  try {
    await pool.query(`
      create table "account" (
        id text primary key,
        access_token text,
        refresh_token text,
        id_token text,
        updated_at timestamptz not null default now()
      );
      create table "oauth_access_token" (
        id text primary key,
        access_token text not null,
        refresh_token text not null,
        refresh_token_hash text,
        updated_at timestamptz not null default now()
      );
      create table "two_factor" (
        id text primary key,
        secret text not null,
        backup_codes text not null
      );
      create table "jwks_key" (
        kid text primary key,
        private_jwk jsonb not null
      );
    `);
    await run(pool);
  } finally {
    await pool.end();
    await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
    await admin.end();
  }
}

describe("auth at-rest backfill integration", () => {
  it.skipIf(!migrationUrl)(
    "inventories, applies idempotently, and verifies zero pending rows",
    async () => {
      await withAuthDatabase(async (pool) => {
        await pool.query(
          `insert into "account" (id, access_token, refresh_token, id_token)
           values
             ($1, $2, $3, $4),
             ($5, $6, $7, $8),
             ($9, $10, $11, $12)`,
          [
            "acct-1",
            "access-plain",
            "refresh-plain",
            null,
            "acct-2",
            "access-plain-2",
            null,
            null,
            "acct-3",
            "",
            null,
            null,
          ],
        );
        await pool.query(
          `insert into "oauth_access_token" (id, access_token, refresh_token)
           values ($1, $2, $3)`,
          ["tok-1", "access-plain", "refresh-plain"],
        );
        await pool.query(
          `insert into "two_factor" (id, secret, backup_codes)
           values ($1, $2, $3)`,
          ["tf-1", "secret-plain", '["code"]'],
        );
        await pool.query(
          `insert into "jwks_key" (kid, private_jwk) values ($1, to_jsonb($2::text))`,
          ["kid-1", '{"kty":"RSA","d":"secret"}'],
        );

        const before = await inventoryAuthAtRest(pool);
        expect(totalAuthAtRestPending(before)).toBe(6);
        expect(await hasAuthAtRestPending(pool)).toBe(true);

        const crypto = createEnvelopeCrypto(parseAuthDekKey("11".repeat(32)));
        const batches: AuthAtRestBatchProgress[] = [];
        const firstPass = await applyAuthAtRestBackfill(pool, {
          crypto,
          batchSize: 1,
          onBatch: (progress) => batches.push(progress),
        });
        expect(firstPass.account).toBe(3);
        expect(firstPass.oauthAccessToken).toBe(1);
        expect(firstPass.twoFactor).toBe(1);
        expect(firstPass.jwksKey).toBe(1);
        expect(batches.filter((batch) => batch.category === "account")).toHaveLength(3);
        expect(batches.every((batch) => batch.scanned <= 1)).toBe(true);

        await verifyAuthAtRestComplete(pool, crypto, 1);
        const secondPass = await applyAuthAtRestBackfill(pool, { crypto, batchSize: 10 });
        expect(secondPass.account).toBe(0);
        expect(secondPass.oauthAccessToken).toBe(0);
        expect(secondPass.twoFactor).toBe(0);
        expect(secondPass.jwksKey).toBe(0);
        const after = await inventoryAuthAtRest(pool);
        expect(totalAuthAtRestPending(after)).toBe(0);
      });
    },
  );

  it.skipIf(!migrationUrl)(
    "skips a concurrently locked row without overwriting it and completes on rerun",
    async () => {
      await withAuthDatabase(async (pool) => {
        await pool.query(
          `insert into "account" (id, access_token, refresh_token, id_token)
           values ($1, $2, $3, $4)`,
          ["acct-locked", "initial-plain", null, null],
        );
        const crypto = createEnvelopeCrypto(parseAuthDekKey("22".repeat(32)));
        const locker = await pool.connect();
        try {
          await locker.query("begin");
          await locker.query(`select id from "account" where id = $1 for update`, ["acct-locked"]);

          const skipped = await applyAuthAtRestBackfill(pool, { crypto, batchSize: 10 });
          expect(skipped.account).toBe(0);

          await locker.query(`update "account" set access_token = $2 where id = $1`, [
            "acct-locked",
            "concurrent-plain",
          ]);
          await locker.query("commit");
        } finally {
          await locker.query("rollback").catch(() => undefined);
          locker.release();
        }

        const beforeRerun = await pool.query<{ access_token: string }>(
          `select access_token from "account" where id = $1`,
          ["acct-locked"],
        );
        expect(beforeRerun.rows[0]?.access_token).toBe("concurrent-plain");

        const rerun = await applyAuthAtRestBackfill(pool, { crypto, batchSize: 10 });
        expect(rerun.account).toBe(1);
        await verifyAuthAtRestComplete(pool, crypto);
      });
    },
  );
});
