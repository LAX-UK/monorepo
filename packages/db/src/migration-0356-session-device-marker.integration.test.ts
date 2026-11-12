import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type pg from "pg";
import { describe, expect, it } from "vitest";
import {
  runMigrationsPerTransaction,
  runMigrationsPerTransactionThrough,
} from "./migrate-runner.js";
import {
  migrationTestDatabaseUrl as migrationUrl,
  withTemporaryDatabase,
} from "./testing/temporary-database.js";

/** The journal time of the last migration before 0356. */
const BEFORE_0356_FOLDER_MILLIS = 1805702400000;

const sql = (name: string) => readFile(resolve(import.meta.dirname, "../drizzle", name), "utf8");

async function columnsOf(pool: pg.Pool, table: string): Promise<string[]> {
  const { rows } = await pool.query<{ column_name: string }>(
    `select column_name from information_schema.columns
     where table_schema = 'public' and table_name = $1 order by column_name`,
    [table],
  );
  return rows.map((row) => row.column_name);
}

async function insertSession(pool: pg.Pool, userId: string, id: string): Promise<void> {
  await pool.query(
    `insert into session (id, expires_at, token, created_at, updated_at, user_id)
     values ($1, now() + interval '7 days', $1, now(), now(), $2)`,
    [id, userId],
  );
}

describe.skipIf(!migrationUrl)("migration 0356 session device marker", { timeout: 60_000 }, () => {
  it("keeps older sign-in records working, ties lineage to its record and person, and rolls back", async () => {
    await withTemporaryDatabase(async (pool) => {
      await runMigrationsPerTransactionThrough(pool, BEFORE_0356_FOLDER_MILLIS);
      const userId = `device-user-${randomUUID()}`;
      await pool.query(
        `insert into "user" (id, name, email, email_verified, created_at, updated_at)
         values ($1, $1, $2, true, now(), now())`,
        [userId, `${userId}@integration.test`],
      );
      // A record made by the previous release.
      await insertSession(pool, userId, "legacy-session");

      await runMigrationsPerTransaction(pool);

      const legacy = await pool.query(
        `select device_hash, signed_in_at, last_seen_at, country from session where id = 'legacy-session'`,
      );
      expect(legacy.rows[0]).toEqual({
        device_hash: null,
        signed_in_at: null,
        last_seen_at: null,
        country: null,
      });

      await insertSession(pool, userId, "current-session");
      await pool.query(
        `insert into session_lineage (previous_sid, session_id, user_id)
         values ('earlier-name', 'current-session', $1)`,
        [userId],
      );
      // A name is unique, and never points at a record or person that does not exist.
      await expect(
        pool.query(
          `insert into session_lineage (previous_sid, session_id, user_id)
           values ('earlier-name', 'legacy-session', $1)`,
          [userId],
        ),
      ).rejects.toMatchObject({ code: "23505" });
      await expect(
        pool.query(
          `insert into session_lineage (previous_sid, session_id, user_id)
           values ('x', 'no-such-session', $1)`,
          [userId],
        ),
      ).rejects.toMatchObject({ code: "23503" });

      // Names go with their record.
      await pool.query(`delete from session where id = 'current-session'`);
      const names = await pool.query("select count(*)::int as n from session_lineage");
      expect(names.rows[0]?.n).toBe(0);

      // And with the person.
      await insertSession(pool, userId, "another-session");
      await pool.query(
        `insert into session_lineage (previous_sid, session_id, user_id)
         values ('other-name', 'another-session', $1)`,
        [userId],
      );
      await pool.query(`delete from "user" where id = $1`, [userId]);
      expect((await pool.query("select count(*)::int as n from session_lineage")).rows[0]?.n).toBe(
        0,
      );

      // Rolling back removes only what this migration added, and re-applying is idempotent.
      await pool.query(await sql("0356_rollback.sql"));
      expect(await columnsOf(pool, "session")).not.toEqual(expect.arrayContaining(["device_hash"]));
      expect(await columnsOf(pool, "session_lineage")).toEqual([]);
      expect(await columnsOf(pool, "session")).toEqual(
        expect.arrayContaining(["amr", "last_password_auth_at", "token", "user_id"]),
      );
      await pool.query(await sql("0356_session_device_marker.sql"));
      await pool.query(await sql("0356_session_device_marker.sql"));
      expect(await columnsOf(pool, "session")).toEqual(
        expect.arrayContaining(["country", "device_hash", "last_seen_at", "signed_in_at"]),
      );
    });
  });
});
