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

const NEW_TYPES = ["delivery_quote_ready", "payout_problem", "bid_refused_limit"];
/** Types added by the migrations before this one, which the rebuilt constraint must keep. */
const KEPT_TYPES = [
  "outbid",
  "lot_delivered",
  "staff_role_changed_admin",
  "organisation_member_left",
  "payout_bank_changed",
];

/** Runs in one transaction that is always rolled back; each probe sits in a savepoint. */
describe.skipIf(!migrationUrl)(
  "migration 0257 workspace buying modules",
  { timeout: 30_000 },
  () => {
    let client: pg.Client;
    let userId: string;

    async function succeeds(sql: string, params: unknown[]): Promise<boolean> {
      await client.query("savepoint probe");
      try {
        await client.query(sql, params);
        return true;
      } catch {
        return false;
      } finally {
        await client.query("rollback to savepoint probe");
      }
    }

    const acceptsType = (type: string) =>
      succeeds(
        `insert into notification (user_id, type, title, message) values ($1, $2, 't', 'm')`,
        [userId, type],
      );

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
      const user = await client.query(
        `insert into "user" (id, email, name, created_at, updated_at) values (gen_random_uuid()::text, $1, 'Probe', now(), now()) returning id`,
        [`probe-${Date.now()}@example.com`],
      );
      userId = user.rows[0].id as string;
    });

    it("allows the new notices and keeps every earlier one", async () => {
      await client.query(read("0257_workspace_buying_modules.sql"));
      for (const type of [...NEW_TYPES, ...KEPT_TYPES]) expect(await acceptsType(type)).toBe(true);
      expect(await acceptsType("not_a_type")).toBe(false);
    });

    it("keeps alert price ranges ordered and positive", async () => {
      await client.query(read("0257_workspace_buying_modules.sql"));
      const artist = await client.query(
        `insert into artist_profile (display_name, slug) values ('Probe', $1) returning id`,
        [`probe-${Date.now()}`],
      );
      const insert = `insert into artist_watchlist (user_id, artist_id, alert_price_min, alert_price_max)
                    values ($1, $2, $3, $4)`;
      const artistId = artist.rows[0].id;
      expect(await succeeds(insert, [userId, artistId, "100", "500"])).toBe(true);
      expect(await succeeds(insert, [userId, artistId, "900", "500"])).toBe(false);
      expect(await succeeds(insert, [userId, artistId, "-1", null])).toBe(false);
    });

    it("rolls back to the previous list and removes the notices it could not keep", async () => {
      await client.query(read("0257_workspace_buying_modules.sql"));
      await client.query(
        `insert into notification (user_id, type, title, message)
       values ($1, 'delivery_quote_ready', 't', 'm'), ($1, 'outbid', 't', 'm')`,
        [userId],
      );
      await client.query(read("0257_rollback.sql"));

      for (const type of NEW_TYPES) expect(await acceptsType(type)).toBe(false);
      for (const type of KEPT_TYPES) expect(await acceptsType(type)).toBe(true);
      const left = await client.query("select type from notification where user_id = $1", [userId]);
      expect(left.rows).toEqual([{ type: "outbid" }]);
      const table = await client.query("select to_regclass('delivery_quote') as t");
      expect(table.rows[0].t).toBeNull();
    });
  },
);
