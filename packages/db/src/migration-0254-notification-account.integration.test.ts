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

const BUYER = "buyer-0254";
const SELLER_USER = "seller-0254";
const LOT = "54000000-0000-4000-8000-000000000001";
const SUBMISSION = "54000000-0000-4000-8000-000000000002";
const BUYER_ORG = "54000000-0000-4000-8000-0000000000a1";
const SELLER_ORG = "54000000-0000-4000-8000-0000000000b1";
const CONSIGNOR_ORG = "54000000-0000-4000-8000-0000000000c1";

/**
 * Runs in one transaction that is always rolled back. Foreign keys are switched off inside it so
 * the probe can hold notifications for records it creates only in part.
 */
describe.skipIf(!migrationUrl)(
  "migration 0254 notification account backfill",
  { timeout: 30_000 },
  () => {
    let client: pg.Client;

    async function notify(id: string, userId: string, type: string, ref: Record<string, string>) {
      await client.query(
        `insert into notification (id, user_id, type, title, message, lot_id, submission_id)
         values ($1, $2, $3, 't', 'm', $4, $5)`,
        [id, userId, type, ref.lot ?? null, ref.submission ?? null],
      );
    }

    async function accounts(): Promise<Record<string, string | null>> {
      const rows = await client.query(
        "select id, legal_entity_id from notification where user_id = any($1)",
        [[BUYER, SELLER_USER]],
      );
      return Object.fromEntries(rows.rows.map((row) => [row.id, row.legal_entity_id]));
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
      await client.query(read("0254_notification_account.sql"));
    });

    it("takes the account from the source record and leaves the rest personal", async () => {
      await client.query(
        `insert into lot (id, title, auction_type, starting_price, current_price, min_bid_increment,
           start_time, end_time, status, seller_legal_entity_id, winner_id, buyer_legal_entity_id)
         values ($1, 'Lot', 'english', 100, 900, 10, now() - interval '2 days', now() - interval '1 day',
           'ended', $2, $3, $4)`,
        [LOT, SELLER_ORG, BUYER, BUYER_ORG],
      );
      await client.query(
        `insert into bid (lot_id, bidder_id, buyer_legal_entity_id, amount)
         values ($1, $2, $3, 800), ($1, $2, $3, 900)`,
        [LOT, BUYER, BUYER_ORG],
      );
      await client.query(
        `insert into legal_entity_member (legal_entity_id, user_id, role, accepted_at)
         values ($1, $2, 'owner', now())`,
        [SELLER_ORG, SELLER_USER],
      );
      await client.query(
        `insert into item_submission (id, legal_entity_id, title, status)
         values ($1, $2, 'Work', 'submitted')`,
        [SUBMISSION, CONSIGNOR_ORG],
      );

      const ids = {
        outbid: "54000000-0000-4000-8000-000000000e01",
        won: "54000000-0000-4000-8000-000000000e02",
        sold: "54000000-0000-4000-8000-000000000e03",
        submission: "54000000-0000-4000-8000-000000000e04",
        watchlist: "54000000-0000-4000-8000-000000000e05",
        kyc: "54000000-0000-4000-8000-000000000e06",
      };
      await notify(ids.outbid, BUYER, "outbid", { lot: LOT });
      await notify(ids.won, BUYER, "lot_won", { lot: LOT });
      await notify(ids.sold, SELLER_USER, "lot_ended_seller", { lot: LOT });
      await notify(ids.submission, SELLER_USER, "submission_approved", { submission: SUBMISSION });
      await notify(ids.watchlist, BUYER, "watchlist_starting", { lot: LOT });
      await notify(ids.kyc, BUYER, "kyc_resubmission_required", {});

      await client.query(read("0254_notification_account.sql"));

      expect(await accounts()).toEqual({
        [ids.outbid]: BUYER_ORG,
        [ids.won]: BUYER_ORG,
        [ids.sold]: SELLER_ORG,
        [ids.submission]: CONSIGNOR_ORG,
        [ids.watchlist]: null,
        [ids.kyc]: null,
      });
    });

    it("rolls back cleanly", async () => {
      await client.query(read("0254_rollback.sql"));
      const column = await client.query(
        `select 1 from information_schema.columns
         where table_name = 'notification' and column_name = 'legal_entity_id'`,
      );
      expect(column.rowCount).toBe(0);
      const table = await client.query("select to_regclass('notification_account_mute') as t");
      expect(table.rows[0]?.t).toBeNull();
    });
  },
);
