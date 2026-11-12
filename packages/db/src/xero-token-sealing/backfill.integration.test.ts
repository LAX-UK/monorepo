import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { describe, expect, it } from "vitest";
import { buildPgConnectionConfig } from "../ssl.js";
import {
  backfillXeroTokenSealing,
  countPlaintextXeroTokens,
  verifyXeroTokensSealed,
} from "./backfill.js";
import { XeroTokenSealer } from "./sealing.js";

const migrationUrl = process.env.MIGRATION_TEST_DATABASE_URL;
const here = dirname(fileURLToPath(import.meta.url));
const migrationSql = readFileSync(join(here, "../../drizzle/0367_xero_token_sealing.sql"), "utf8");
const rollbackSql = readFileSync(join(here, "../../drizzle/0367_rollback.sql"), "utf8");
const statements = (sql: string) => sql.replaceAll("--> statement-breakpoint", "");

async function withDatabase(run: (pool: pg.Pool) => Promise<void>): Promise<void> {
  if (!migrationUrl) throw new Error("MIGRATION_TEST_DATABASE_URL is required");
  const name = `xero_seal_${randomUUID().replaceAll("-", "")}`;
  const adminUrl = new URL(migrationUrl);
  adminUrl.pathname = "/postgres";
  const dbUrl = new URL(migrationUrl);
  dbUrl.pathname = `/${name}`;
  const admin = new pg.Client(buildPgConnectionConfig(adminUrl.toString()));
  await admin.connect();
  await admin.query(`CREATE DATABASE "${name}"`);
  const pool = new pg.Pool(buildPgConnectionConfig(dbUrl.toString()));
  try {
    await pool.query(`
      create type xero_connection_status as enum ('healthy', 'needs_reauth');
      create table xero_connection (
        id uuid primary key default gen_random_uuid(),
        tenant_id text not null unique,
        access_token text not null,
        refresh_token text not null,
        expires_at timestamptz not null default now(),
        connection_status xero_connection_status not null default 'healthy'
      )`);
    await run(pool);
  } finally {
    await pool.end();
    await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await admin.end();
  }
}

const sealer = XeroTokenSealer.fromKey(randomBytes(32).toString("hex"));
const rows = (pool: pg.Pool) =>
  pool.query(
    "select tenant_id, access_token, refresh_token, access_token_sealed, refresh_token_sealed from xero_connection order by tenant_id",
  );

describe.skipIf(!migrationUrl)(
  "Xero token sealing backfill (integration)",
  { timeout: 60_000 },
  () => {
    it("seals legacy rows, nulls the plaintext, and is idempotent", async () => {
      await withDatabase(async (pool) => {
        await pool.query(
          "insert into xero_connection (tenant_id, access_token, refresh_token) values ('t1','a1','r1'), ('t2','a2','r2')",
        );
        await pool.query(migrationSql.replaceAll("--> statement-breakpoint", ""));
        expect(await countPlaintextXeroTokens(pool)).toBe(2);
        await expect(verifyXeroTokensSealed(pool, sealer)).rejects.toThrow(/plaintext_remaining/);

        expect(await backfillXeroTokenSealing(pool, sealer)).toEqual({ sealed: 2, skipped: 0 });

        const after = (await rows(pool)).rows;
        for (const row of after) {
          expect(row.access_token).toBeNull();
          expect(row.refresh_token).toBeNull();
          expect(row.access_token_sealed).toMatch(/^v1:/);
        }
        expect(
          sealer.open({
            accessToken: null,
            refreshToken: null,
            accessTokenSealed: after[0]?.access_token_sealed,
            refreshTokenSealed: after[0]?.refresh_token_sealed,
          }),
        ).toEqual({ accessToken: "a1", refreshToken: "r1" });

        const snapshot = JSON.stringify(after);
        expect(await backfillXeroTokenSealing(pool, sealer)).toEqual({ sealed: 0, skipped: 0 });
        expect(JSON.stringify((await rows(pool)).rows)).toBe(snapshot);
        await expect(verifyXeroTokensSealed(pool, sealer)).resolves.toBeUndefined();
      });
    });

    it("lets a plaintext value written after sealing win over the stale sealed one", async () => {
      await withDatabase(async (pool) => {
        await pool.query(migrationSql.replaceAll("--> statement-breakpoint", ""));
        const stale = sealer.seal({ accessToken: "old-a", refreshToken: "old-r" });
        await pool.query(
          "insert into xero_connection (tenant_id, access_token, refresh_token, access_token_sealed, refresh_token_sealed) values ('t1','new-a','new-r',$1,$2)",
          [stale.accessTokenSealed, stale.refreshTokenSealed],
        );
        await backfillXeroTokenSealing(pool, sealer);
        const [row] = (await rows(pool)).rows;
        expect(
          sealer.open({
            accessToken: null,
            refreshToken: null,
            accessTokenSealed: row?.access_token_sealed,
            refreshTokenSealed: row?.refresh_token_sealed,
          }),
        ).toEqual({ accessToken: "new-a", refreshToken: "new-r" });
      });
    });

    it("does not overwrite a row a token refresh changed after it was read", async () => {
      await withDatabase(async (pool) => {
        await pool.query(
          "insert into xero_connection (tenant_id, access_token, refresh_token) values ('t1','a1','r1')",
        );
        await pool.query(migrationSql.replaceAll("--> statement-breakpoint", ""));
        const racing = {
          query: async (sql: string, params?: unknown[]) => {
            if (sql.trimStart().startsWith("update")) {
              await pool.query("update xero_connection set access_token = 'rotated'");
            }
            return pool.query(sql, params);
          },
        };
        expect(await backfillXeroTokenSealing(racing, sealer)).toEqual({ sealed: 0, skipped: 1 });
        expect((await rows(pool)).rows[0]?.access_token).toBe("rotated");
        expect(await backfillXeroTokenSealing(pool, sealer)).toEqual({ sealed: 1, skipped: 0 });
      });
    });

    it("refuses to run without a key and leaves rows untouched", async () => {
      await withDatabase(async (pool) => {
        await pool.query(
          "insert into xero_connection (tenant_id, access_token, refresh_token) values ('t1','a1','r1')",
        );
        await pool.query(migrationSql.replaceAll("--> statement-breakpoint", ""));
        await expect(backfillXeroTokenSealing(pool, XeroTokenSealer.unavailable())).rejects.toThrow(
          /key_missing/,
        );
        expect((await rows(pool)).rows[0]?.access_token).toBe("a1");
      });
    });

    it("rolls back by keeping the connection and flagging it for reconnect", async () => {
      await withDatabase(async (pool) => {
        await pool.query(
          "insert into xero_connection (tenant_id, access_token, refresh_token) values ('t1','a1','r1')",
        );
        await pool.query(statements(migrationSql));
        await backfillXeroTokenSealing(pool, sealer);
        await pool.query(statements(rollbackSql));
        const { rows: out } = await pool.query(
          "select access_token, refresh_token, connection_status from xero_connection",
        );
        expect(out).toEqual([
          { access_token: "", refresh_token: "", connection_status: "needs_reauth" },
        ]);
        // And the forward migration applies again after a rollback.
        await pool.query(statements(migrationSql));
      });
    });
  },
);
