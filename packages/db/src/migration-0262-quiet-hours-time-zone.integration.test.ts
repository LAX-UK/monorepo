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

const USER = "user-0262";

/**
 * Runs against a database migrated to the head, inside one transaction that is always rolled
 * back: it steps 0262 back to UTC times, then forward again, and checks both directions.
 */
describe.skipIf(!migrationUrl)("migration 0262 quiet hours time zone", { timeout: 30_000 }, () => {
  let client: pg.Client;

  /** "HH:MM" UTC for a London wall time today, as the migration computes it. */
  async function londonToday(utc: string): Promise<string> {
    const row = await client.query(
      `select to_char(((current_date + $1::time) at time zone 'UTC') at time zone 'Europe/London', 'HH24:MI') as t`,
      [utc],
    );
    return row.rows[0].t;
  }

  async function prefs() {
    const row = await client.query(
      "select quiet_start, quiet_end from notification_preference where user_id = $1",
      [USER],
    );
    return row.rows[0];
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
    await client.query(read("0262_rollback.sql"));
    await client.query(
      `insert into notification_preference (user_id, quiet_start, quiet_end)
       values ($1, '21:00', '06:00'), ($1 || '-unset', null, null), ($1 || '-odd', '9pm', '06:00')`,
      [USER],
    );
    await client.query(read("0262_quiet_hours_time_zone.sql"));
  });

  it("turns stored UTC times into London times, with London as the zone", async () => {
    expect(await prefs()).toEqual({
      quiet_start: await londonToday("21:00"),
      quiet_end: await londonToday("06:00"),
    });
    const zones = await client.query(
      "select distinct quiet_time_zone from notification_preference where user_id like $1",
      [`${USER}%`],
    );
    expect(zones.rows).toEqual([{ quiet_time_zone: "Europe/London" }]);
  });

  it("leaves unset and malformed times as they were", async () => {
    const rows = await client.query(
      "select user_id, quiet_start, quiet_end from notification_preference where user_id <> $1 and user_id like $2 order by user_id",
      [USER, `${USER}%`],
    );
    expect(rows.rows).toEqual([
      { user_id: `${USER}-odd`, quiet_start: "9pm", quiet_end: "06:00" },
      { user_id: `${USER}-unset`, quiet_start: null, quiet_end: null },
    ]);
  });

  it("rolls back to the same UTC times and drops the zone", async () => {
    await client.query(read("0262_rollback.sql"));
    expect(await prefs()).toEqual({ quiet_start: "21:00", quiet_end: "06:00" });
    const column = await client.query(
      `select 1 from information_schema.columns
       where table_name = 'notification_preference' and column_name = 'quiet_time_zone'`,
    );
    expect(column.rowCount).toBe(0);
  });
});
