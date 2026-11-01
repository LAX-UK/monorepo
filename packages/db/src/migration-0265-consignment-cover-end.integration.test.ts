import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildPgConnectionConfig } from "./ssl.js";

const migrationUrl = process.env.MIGRATION_TEST_DATABASE_URL;
const drizzleDir = join(dirname(fileURLToPath(import.meta.url)), "../drizzle");
const read = (name: string) =>
  readFileSync(join(drizzleDir, name), "utf8")
    .replaceAll("--> statement-breakpoint", "")
    .replace("SET LOCAL lock_timeout = '30s';", "");

const THREAD = "00000000-0000-4000-8000-0000000265a1";
const SUBMISSION = "00000000-0000-4000-8000-0000000265b1";

/**
 * Runs against a database migrated to the head, inside one transaction that is always rolled
 * back: it steps 0265 back, seeds a covered thread the way 0264 left it, applies 0265, and checks
 * the new column, its indexes and the rollback.
 */
describe.skipIf(!migrationUrl)("migration 0265 consignment cover end", { timeout: 30_000 }, () => {
  let client: pg.Client;

  beforeAll(async () => {
    client = new pg.Client(buildPgConnectionConfig(migrationUrl as string));
    await client.connect();
  });

  afterAll(async () => {
    await client.query("rollback");
    await client.end();
  });

  beforeEach(async () => {
    await client.query("rollback");
    await client.query("begin");
    await client.query("set local session_replication_role = replica");
    await client.query(read("0265_rollback.sql"));
    await client.query(
      `insert into consignment_thread (id, submission_id, last_message_at, last_message_side)
       values ($1, $2, '2026-10-01T09:00:00Z', 'client')`,
      [THREAD, SUBMISSION],
    );
    await client.query(read("0265_consignment_cover_end.sql"));
  });

  it("adds an end date that is empty for existing threads", async () => {
    const row = await client.query("select covering_until from consignment_thread where id = $1", [
      THREAD,
    ]);
    expect(row.rows[0]).toEqual({ covering_until: null });
  });

  it("stores an end date", async () => {
    await client.query(
      "update consignment_thread set covering_until = '2026-11-12T00:00:00Z' where id = $1",
      [THREAD],
    );
    const row = await client.query("select covering_until from consignment_thread where id = $1", [
      THREAD,
    ]);
    expect((row.rows[0]?.covering_until as Date).toISOString()).toBe("2026-11-12T00:00:00.000Z");
  });

  it("creates the sweep indexes", async () => {
    const rows = await client.query(
      `select indexname from pg_indexes
       where indexname in ('consignment_thread_cover_end_idx', 'consignment_message_unnotified_idx')
       order by indexname`,
    );
    expect(rows.rows.map((r) => r.indexname)).toEqual([
      "consignment_message_unnotified_idx",
      "consignment_thread_cover_end_idx",
    ]);
  });

  it("can be applied twice", async () => {
    await client.query(read("0265_consignment_cover_end.sql"));
  });

  it("rolls back to the columns and indexes 0264 left, keeping threads", async () => {
    await client.query(read("0265_rollback.sql"));
    const column = await client.query(
      `select count(*)::int as n from information_schema.columns
       where table_name = 'consignment_thread' and column_name = 'covering_until'`,
    );
    expect(column.rows[0].n).toBe(0);
    const indexes = await client.query(
      `select count(*)::int as n from pg_indexes
       where indexname in ('consignment_thread_cover_end_idx', 'consignment_message_unnotified_idx')`,
    );
    expect(indexes.rows[0].n).toBe(0);
    const threads = await client.query(
      "select count(*)::int as n from consignment_thread where id = $1",
      [THREAD],
    );
    expect(threads.rows[0].n).toBe(1);
  });
});
