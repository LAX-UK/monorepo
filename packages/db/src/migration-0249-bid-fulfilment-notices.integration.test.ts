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

const NEW_TYPES = ["lot_ready_for_collection", "lot_shipped", "lot_delivered"];
const OLD_TYPES = ["outbid", "lot_won", "payment_due", "staff_role_expired", "staff_role_changed"];

/** Runs in one transaction that is always rolled back; each probe sits in a savepoint. */
describe.skipIf(!migrationUrl)("migration 0249 bid fulfilment notices", { timeout: 30_000 }, () => {
  let client: pg.Client;
  let userId: string;

  async function accepts(type: string): Promise<boolean> {
    await client.query("savepoint probe");
    try {
      await client.query(
        `insert into notification (user_id, type, title, message) values ($1, $2, 't', 'm')`,
        [userId, type],
      );
      return true;
    } catch {
      return false;
    } finally {
      await client.query("rollback to savepoint probe");
    }
  }

  beforeAll(async () => {
    client = new pg.Client(buildPgConnectionConfig(migrationUrl as string));
    await client.connect();
  });

  afterAll(async () => {
    await client.end();
  });

  beforeEach(async () => {
    await client.query("rollback");
    await client.query("begin");
    const user = await client.query(
      `insert into "user" (id, email, name, created_at, updated_at) values (gen_random_uuid()::text, $1, 'Probe', now(), now()) returning id`,
      [`probe-${Date.now()}@example.com`],
    );
    userId = user.rows[0].id as string;
  });

  it("accepts the new types, and the old ones still", async () => {
    await client.query(read("0249_bid_fulfilment_notices.sql"));
    for (const type of [...NEW_TYPES, ...OLD_TYPES]) expect(await accepts(type)).toBe(true);
    expect(await accepts("not_a_type")).toBe(false);
  });

  it("rolls back to the previous list and removes the notices it could not keep", async () => {
    await client.query(read("0249_bid_fulfilment_notices.sql"));
    await client.query(
      `insert into notification (user_id, type, title, message)
       values ($1, 'lot_shipped', 't', 'm'), ($1, 'outbid', 't', 'm')`,
      [userId],
    );
    await client.query(read("0249_rollback.sql"));

    for (const type of NEW_TYPES) expect(await accepts(type)).toBe(false);
    for (const type of OLD_TYPES) expect(await accepts(type)).toBe(true);
    const left = await client.query("select type from notification where user_id = $1", [userId]);
    expect(left.rows).toEqual([{ type: "outbid" }]);
  });
});
