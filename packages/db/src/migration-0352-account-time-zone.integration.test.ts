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

const NOW = "2026-11-10T09:00:00Z";

/**
 * Runs against a database migrated to the head, inside one transaction that is always rolled
 * back: it steps 0352 back, seeds people, then forward again, and checks the backfill and the
 * constraints.
 */
describe.skipIf(!migrationUrl)("migration 0352 account time zone", { timeout: 30_000 }, () => {
  let client: pg.Client;

  async function addPerson(
    id: string,
    quiet: { start: string | null; end: string | null; zone: string },
  ) {
    await client.query(
      `insert into "user" (id, name, email, created_at, updated_at) values ($1, $1, $1 || '@example.test', $2, $2)`,
      [id, NOW],
    );
    await client.query(
      `insert into bid_identity_directory (subject_id, email, name, identity_created_at)
       values ($1, $1 || '@example.test', $1, $2)`,
      [id, NOW],
    );
    await client.query(
      `insert into notification_preference (user_id, quiet_start, quiet_end, quiet_time_zone)
       values ($1, $2, $3, $4)`,
      [id, quiet.start, quiet.end, quiet.zone],
    );
  }

  async function zoneOf(id: string) {
    const user = await client.query(`select time_zone_mode, time_zone from "user" where id = $1`, [
      id,
    ]);
    const directory = await client.query(
      "select time_zone_mode, time_zone from bid_identity_directory where subject_id = $1",
      [id],
    );
    return { user: user.rows[0], directory: directory.rows[0] };
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
    await client.query(read("0352_rollback.sql"));
    await addPerson("tz-set-sydney", { start: "21:00", end: "06:00", zone: "Australia/Sydney" });
    await addPerson("tz-set-default", { start: "22:00", end: "07:00", zone: "Europe/London" });
    await addPerson("tz-unset", { start: null, end: null, zone: "Europe/London" });
    await addPerson("tz-half-set", { start: "21:00", end: null, zone: "Asia/Tokyo" });
    await addPerson("tz-bad-zone", { start: "21:00", end: "06:00", zone: "UTC" });
    await client.query(read("0352_account_time_zone.sql"));
  });

  it("leaves everyone on automatic with no zone, whatever their quiet hours say", async () => {
    for (const id of [
      "tz-set-sydney",
      "tz-set-default",
      "tz-unset",
      "tz-half-set",
      "tz-bad-zone",
    ]) {
      const row = await zoneOf(id);
      expect(row.user).toEqual({ time_zone_mode: "automatic", time_zone: null });
      expect(row.directory).toEqual({ time_zone_mode: "automatic", time_zone: null });
    }
  });

  it("keeps quiet_time_zone for the release that is rolled back to", async () => {
    const row = await client.query(
      "select quiet_time_zone from notification_preference where user_id = 'tz-set-sydney'",
    );
    expect(row.rows[0].quiet_time_zone).toBe("Australia/Sydney");
  });

  it("refuses a fixed choice without a zone, and a zone that names no place", async () => {
    await client.query("savepoint s1");
    await expect(
      client.query(
        `update "user" set time_zone_mode = 'fixed', time_zone = null where id = 'tz-unset'`,
      ),
    ).rejects.toThrow();
    await client.query("rollback to savepoint s1");
    for (const zone of ["UTC", "Etc/GMT+5", "London"]) {
      await client.query("savepoint s2");
      await expect(
        client.query(`update "user" set time_zone = $1 where id = 'tz-unset'`, [zone]),
      ).rejects.toThrow();
      await client.query("rollback to savepoint s2");
    }
    await client.query("savepoint s3");
    await expect(
      client.query(`update "user" set time_zone_mode = 'sometimes' where id = 'tz-unset'`),
    ).rejects.toThrow();
    await client.query("rollback to savepoint s3");
  });

  it("rolls back cleanly and can be applied again", async () => {
    await client.query(read("0352_rollback.sql"));
    const gone = await client.query(
      `select column_name from information_schema.columns
        where table_schema = 'public' and column_name in ('time_zone', 'time_zone_mode', 'time_zone_reported_at')
          and table_name in ('user', 'bid_identity_directory')`,
    );
    expect(gone.rows).toEqual([]);
    await client.query(read("0352_account_time_zone.sql"));
    expect((await zoneOf("tz-set-sydney")).user.time_zone_mode).toBe("automatic");
  });
});
