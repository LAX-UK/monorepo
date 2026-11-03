import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildPgConnectionConfig } from "./ssl.js";

const migrationUrl = process.env.MIGRATION_TEST_DATABASE_URL;
const drizzleDir = join(dirname(fileURLToPath(import.meta.url)), "../drizzle");
const read = (name: string) =>
  readFileSync(join(drizzleDir, name), "utf8").replaceAll("--> statement-breakpoint", "");

/** Runs in one transaction that is always rolled back. */
describe.skipIf(!migrationUrl)("migration 0280 deletion safety", { timeout: 30_000 }, () => {
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
  });

  async function columns(table: string): Promise<string[]> {
    const rows = await client.query(
      "select column_name from information_schema.columns where table_name = $1",
      [table],
    );
    return rows.rows.map((r: { column_name: string }) => r.column_name);
  }

  it("rolls back and applies again without error", async () => {
    await client.query(read("0280_rollback.sql"));
    expect(await columns("user")).not.toContain("deletion_held_at");
    expect(await columns("shop_user_profile")).not.toContain("deletion_requested_at");
    await client.query(read("0280_deletion_safety.sql"));
    await client.query(read("0280_deletion_safety.sql"));
    expect(await columns("user")).toEqual(
      expect.arrayContaining([
        "deletion_held_at",
        "deletion_hold_reasons",
        "deletion_reminder_sent_at",
      ]),
    );
    expect(await columns("bid_identity_directory")).toEqual(
      expect.arrayContaining(["deletion_held_at", "deletion_hold_reasons"]),
    );
    expect(await columns("shop_user_profile")).toContain("deletion_requested_at");
  });

  it("copies Bid's pending requests to Shop and leaves other people alone", async () => {
    await client.query(read("0280_rollback.sql"));
    await client.query(
      `insert into bid_identity_directory (subject_id, email, name, identity_created_at, deletion_requested_at)
       values ('asked', 'asked@example.com', 'Asked', now(), '2026-11-02T10:00:00Z'),
              ('plain', 'plain@example.com', 'Plain', now(), null)`,
    );
    await client.query(
      `insert into shop_user_profile (identity_subject_id) values ('asked'), ('plain')`,
    );

    await client.query(read("0280_deletion_safety.sql"));

    const rows = await client.query(
      "select identity_subject_id, deletion_requested_at from shop_user_profile where identity_subject_id in ('asked','plain') order by 1",
    );
    expect(
      rows.rows.map(
        (r: { deletion_requested_at: Date | null }) =>
          r.deletion_requested_at?.toISOString() ?? null,
      ),
    ).toEqual(["2026-11-02T10:00:00.000Z", null]);
  });
});
