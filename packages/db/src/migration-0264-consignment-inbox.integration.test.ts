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

const WAITING_AFTER_REPLY = "00000000-0000-4000-8000-0000000264a1";
const WAITING_FROM_START = "00000000-0000-4000-8000-0000000264a2";
const ANSWERED = "00000000-0000-4000-8000-0000000264a3";
const SUBMISSION = (thread: string) => thread.replace("264a", "264b");

/**
 * Runs against a database migrated to the head, inside one transaction that is always rolled
 * back: it steps 0264 back, seeds threads the way 0263 left them, applies 0264, and checks the
 * waiting-since backfill, the new constraints and the rollback.
 */
describe.skipIf(!migrationUrl)("migration 0264 consignment inbox", { timeout: 30_000 }, () => {
  let client: pg.Client;

  async function seedThread(id: string, side: "client" | "staff", messages: [string, string][]) {
    await client.query(
      `insert into consignment_thread (id, submission_id, last_message_at, last_message_side)
       values ($1, $2, $3, $4)`,
      [id, SUBMISSION(id), messages.at(-1)?.[1], side],
    );
    for (const [authorSide, at] of messages) {
      await client.query(
        `insert into consignment_message (thread_id, author_side, body, created_at)
         values ($1, $2, 'hello', $3)`,
        [id, authorSide, at],
      );
    }
  }

  async function awaitingSince(id: string): Promise<string | null> {
    const row = await client.query("select awaiting_since from consignment_thread where id = $1", [
      id,
    ]);
    const value = row.rows[0]?.awaiting_since as Date | null;
    return value ? value.toISOString() : null;
  }

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
    await client.query(read("0264_rollback.sql"));
    await seedThread(WAITING_AFTER_REPLY, "client", [
      ["client", "2026-10-01T09:00:00Z"],
      ["staff", "2026-10-01T10:00:00Z"],
      ["client", "2026-10-02T09:00:00Z"],
      ["client", "2026-10-02T11:00:00Z"],
    ]);
    await seedThread(WAITING_FROM_START, "client", [["client", "2026-10-03T08:30:00Z"]]);
    await seedThread(ANSWERED, "staff", [
      ["client", "2026-10-04T09:00:00Z"],
      ["staff", "2026-10-04T10:00:00Z"],
    ]);
    await client.query(read("0264_consignment_inbox.sql"));
  });

  it("backfills waiting-since from the first client message after the last reply", async () => {
    expect(await awaitingSince(WAITING_AFTER_REPLY)).toBe("2026-10-02T09:00:00.000Z");
    expect(await awaitingSince(WAITING_FROM_START)).toBe("2026-10-03T08:30:00.000Z");
  });

  it("leaves answered threads not waiting, open, and uncovered", async () => {
    expect(await awaitingSince(ANSWERED)).toBeNull();
    const row = await client.query(
      "select closed_at, covering_user_id from consignment_thread where id = $1",
      [ANSWERED],
    );
    expect(row.rows[0]).toEqual({ closed_at: null, covering_user_id: null });
  });

  it("keeps existing messages visible to the thread, never held or notified", async () => {
    const rows = await client.query(
      "select distinct visibility, deliver_after, notified_at from consignment_message",
    );
    expect(rows.rows).toEqual([{ visibility: "thread", deliver_after: null, notified_at: null }]);
  });

  it("refuses a client note and an unknown visibility", async () => {
    await client.query("savepoint s1");
    await expect(
      client.query(
        `insert into consignment_message (thread_id, author_side, visibility, body)
         values ($1, 'client', 'internal', 'x')`,
        [ANSWERED],
      ),
    ).rejects.toThrow(/consignment_message_internal_staff_check/);
    await client.query("rollback to savepoint s1");
    await expect(
      client.query(
        `insert into consignment_message (thread_id, author_side, visibility, body)
         values ($1, 'staff', 'secret', 'x')`,
        [ANSWERED],
      ),
    ).rejects.toThrow(/consignment_message_visibility_check/);
  });

  it("keeps saved reply titles unique ignoring case", async () => {
    await client.query(
      "insert into consignment_saved_reply (title, body) values ('Welcome', 'Hi')",
    );
    await expect(
      client.query("insert into consignment_saved_reply (title, body) values ('welcome', 'Hello')"),
    ).rejects.toThrow(/consignment_saved_reply_title_uidx/);
  });

  it("rolls back to the columns and tables 0263 left, dropping notes", async () => {
    await client.query(
      `insert into consignment_message (thread_id, author_side, visibility, body)
       values ($1, 'staff', 'internal', 'for us')`,
      [ANSWERED],
    );
    await client.query(read("0264_rollback.sql"));
    const notes = await client.query("select count(*)::int as n from consignment_message");
    expect(notes.rows[0].n).toBe(7);
    const columns = await client.query(
      `select count(*)::int as n from information_schema.columns
       where table_name in ('consignment_thread', 'consignment_message')
         and column_name in ('closed_at', 'awaiting_since', 'visibility', 'deliver_after')`,
    );
    expect(columns.rows[0].n).toBe(0);
    const tables = await client.query(
      `select count(*)::int as n from information_schema.tables
       where table_name in ('consignment_thread_event', 'consignment_saved_reply')`,
    );
    expect(tables.rows[0].n).toBe(0);
  });
});
