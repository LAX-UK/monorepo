import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NOTIFICATION_TYPES } from "./schema/notifications.js";
import { buildPgConnectionConfig } from "./ssl.js";

const migrationUrl = process.env.MIGRATION_TEST_DATABASE_URL;

/**
 * Every migration that adds a notification type rebuilds `notification_type_check` with the full
 * list. A rebuild that forgets a type someone else added breaks every send of it in production;
 * this checks the fully migrated database still allows every type the code knows.
 */
describe.skipIf(!migrationUrl)("notification_type_check after all migrations", () => {
  let client: pg.Client;

  beforeAll(async () => {
    client = new pg.Client(buildPgConnectionConfig(migrationUrl as string));
    await client.connect();
  });

  afterAll(async () => {
    await client.end();
  });

  it("allows every notification type in the schema", async () => {
    const res = await client.query(
      `select pg_get_constraintdef(c.oid) as def
       from pg_constraint c
       where c.conname = 'notification_type_check' and c.conrelid = 'notification'::regclass`,
    );
    const def = String(res.rows[0]?.def ?? "");
    const allowed = new Set([...def.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]));
    const missing = NOTIFICATION_TYPES.filter((type) => !allowed.has(type));
    expect(missing).toEqual([]);
  });
});
