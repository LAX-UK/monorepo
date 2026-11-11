import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type pg from "pg";
import { describe, expect, it } from "vitest";
import { runMigrationsPerTransaction } from "./migrate-runner.js";
import {
  migrationTestDatabaseUrl as migrationUrl,
  withTemporaryDatabase,
} from "./testing/temporary-database.js";

const UNIQUE = "23505";
const CHECK = "23514";

async function code(run: Promise<unknown>): Promise<string | undefined> {
  try {
    await run;
    return undefined;
  } catch (error) {
    return (error as { code?: string }).code;
  }
}

async function migrationFile(name: string): Promise<string> {
  const sql = await readFile(resolve(import.meta.dirname, "../drizzle", name), "utf8");
  return sql.replaceAll("--> statement-breakpoint", "");
}

type Fixture = {
  lotId: string;
  defaultId: string;
  sellerEntityId: string;
  userId: string;
  entityId: string;
  bidId: string;
  offer: (over?: { sequence?: number; status?: string }) => Promise<string>;
  consent: (over: {
    status?: string;
    channel?: string | null;
    note?: string | null;
    preferredNext?: string | null;
  }) => Promise<string>;
};

async function fixture(pool: pg.Pool): Promise<Fixture> {
  const userId = `ro-user-${randomUUID()}`;
  const entityId = randomUUID();
  const sellerEntityId = randomUUID();
  const lotId = randomUUID();
  const defaultId = randomUUID();
  await pool.query(
    `insert into "user" (id, name, email, email_verified, created_at, updated_at)
     values ($1, $1, $2, true, now(), now())`,
    [userId, `${userId}@integration.test`],
  );
  for (const id of [entityId, sellerEntityId]) {
    await pool.query(
      `insert into legal_entity (id, display_name, kind, subkind, created_by_user_id, status)
       values ($1, 'Entity', 'individual', 'private_collector', $2, 'approved')`,
      [id, userId],
    );
  }
  await pool.query(
    `insert into lot (id, seller_legal_entity_id, title, auction_type, starting_price,
       current_price, start_time, end_time, status)
     values ($1, $2, 'Re-offer lot', 'english', 100, 1000, now() - interval '30 days',
       now() - interval '20 days', 'ended')`,
    [lotId, sellerEntityId],
  );
  const bidId = randomUUID();
  await pool.query(
    `insert into bid (id, lot_id, bidder_id, buyer_legal_entity_id, amount)
     values ($1, $2, $3, $4, 900)`,
    [bidId, lotId, userId, entityId],
  );
  await pool.query(
    `insert into buyer_default (id, lot_id, buyer_id, buyer_legal_entity_id,
       seller_legal_entity_id, hammer_price, won_at, reason, outcome)
     values ($1, $2, $3, $4, $5, 1000, now(), 'No payment', 'offered_to_underbidder')`,
    [defaultId, lotId, userId, entityId, sellerEntityId],
  );

  const consent: Fixture["consent"] = async (over) => {
    const id = randomUUID();
    await pool.query(
      `insert into seller_consent (id, subject_type, subject_id, seller_legal_entity_id, lot_id,
         terms_snapshot, status, channel, note, preferred_next)
       values ($1, 'lot_reoffer', $2, $3, $4, '{}'::jsonb, $5, $6, $7, $8)`,
      [
        id,
        randomUUID(),
        sellerEntityId,
        lotId,
        over.status ?? "requested",
        over.channel ?? null,
        over.note ?? null,
        over.preferredNext ?? null,
      ],
    );
    return id;
  };

  return {
    lotId,
    defaultId,
    sellerEntityId,
    userId,
    entityId,
    bidId,
    consent,
    async offer(over = {}) {
      const consentId = await consent({});
      const id = randomUUID();
      await pool.query(
        `insert into lot_reoffer (id, lot_id, buyer_default_id, sequence, offered_user_id,
           offered_legal_entity_id, source_bid_id, amount_pence, status, seller_consent_id)
         values ($1, $2, $3, $4, $5, $6, $7, 90000, $8, $9)`,
        [
          id,
          lotId,
          defaultId,
          over.sequence ?? 1,
          userId,
          entityId,
          bidId,
          over.status ?? "awaiting_seller",
          consentId,
        ],
      );
      return id;
    },
  };
}

describe.skipIf(!migrationUrl)("migration 0354 lot re-offer", { timeout: 120_000 }, () => {
  it("allows one open offer per lot, and a new one once the last has ended", async () => {
    await withTemporaryDatabase(async (pool) => {
      await runMigrationsPerTransaction(pool);
      const f = await fixture(pool);
      const first = await f.offer({ sequence: 1, status: "awaiting_seller" });

      for (const status of ["awaiting_seller", "ready", "offered"]) {
        expect(await code(f.offer({ sequence: 2, status })), status).toBe(UNIQUE);
      }

      await pool.query("update lot_reoffer set status = 'declined' where id = $1", [first]);
      await f.offer({ sequence: 2, status: "offered" });
      expect(await code(f.offer({ sequence: 3, status: "ready" }))).toBe(UNIQUE);
    });
  });

  it("allows any number of closed offers on a lot", async () => {
    await withTemporaryDatabase(async (pool) => {
      await runMigrationsPerTransaction(pool);
      const f = await fixture(pool);
      for (const status of [
        "declined",
        "expired",
        "seller_declined",
        "seller_lapsed",
        "withdrawn",
        "accepted",
      ]) {
        // The sequence check allows three, so only the open-offer index is at stake: reuse by
        // giving each offer its own default.
        const defaultId = randomUUID();
        await pool.query(
          `insert into buyer_default (id, lot_id, buyer_id, buyer_legal_entity_id,
             seller_legal_entity_id, hammer_price, won_at, reason, outcome)
           values ($1, $2, $3, $4, $5, 1000, now(), 'No payment', 'offered_to_underbidder')`,
          [defaultId, f.lotId, f.userId, f.entityId, f.sellerEntityId],
        );
        const consentId = await f.consent({});
        await pool.query(
          `insert into lot_reoffer (lot_id, buyer_default_id, sequence, offered_user_id,
             offered_legal_entity_id, source_bid_id, amount_pence, status, seller_consent_id)
           values ($1, $2, 1, $3, $4, $5, 90000, $6, $7)`,
          [f.lotId, defaultId, f.userId, f.entityId, f.bidId, status, consentId],
        );
      }
    });
  });

  it("keeps the sequence between 1 and 3, once per default", async () => {
    await withTemporaryDatabase(async (pool) => {
      await runMigrationsPerTransaction(pool);
      const f = await fixture(pool);
      expect(await code(f.offer({ sequence: 0, status: "declined" }))).toBe(CHECK);
      expect(await code(f.offer({ sequence: 4, status: "declined" }))).toBe(CHECK);
      for (const sequence of [1, 2, 3]) {
        expect(await code(f.offer({ sequence, status: "declined" })), `${sequence}`).toBe(
          undefined,
        );
      }
      expect(await code(f.offer({ sequence: 2, status: "declined" }))).toBe(UNIQUE);
    });
  });

  it("refuses a status the rules do not know, and a zero amount", async () => {
    await withTemporaryDatabase(async (pool) => {
      await runMigrationsPerTransaction(pool);
      const f = await fixture(pool);
      expect(await code(f.offer({ status: "paused" }))).toBe(CHECK);
      const first = await f.offer({ sequence: 1, status: "declined" });
      expect(
        await code(pool.query("update lot_reoffer set amount_pence = 0 where id = $1", [first])),
      ).toBe(CHECK);
    });
  });

  it("records the re-award only on an accepted offer that was answered", async () => {
    await withTemporaryDatabase(async (pool) => {
      await runMigrationsPerTransaction(pool);
      const f = await fixture(pool);
      const declined = await f.offer({ sequence: 1, status: "declined" });
      const accepted = await f.offer({ sequence: 2, status: "accepted" });
      const stamp = "update lot_reoffer set reawarded_at = now() where id = $1";
      expect(await code(pool.query(stamp, [declined]))).toBe(CHECK);
      // Accepted, but with no time of acceptance.
      expect(await code(pool.query(stamp, [accepted]))).toBe(CHECK);
      await pool.query("update lot_reoffer set responded_at = now() where id = $1", [accepted]);
      expect(await code(pool.query(stamp, [accepted]))).toBe(undefined);
    });
  });

  it("requires a note when staff record the seller's answer", async () => {
    await withTemporaryDatabase(async (pool) => {
      await runMigrationsPerTransaction(pool);
      const f = await fixture(pool);
      const staff = { status: "given", channel: "recorded_by_staff" };
      expect(await code(f.consent({ ...staff, note: null }))).toBe(CHECK);
      expect(await code(f.consent({ ...staff, note: "" }))).toBe(CHECK);
      expect(await code(f.consent({ ...staff, note: "   " }))).toBe(CHECK);
      expect(await code(f.consent({ ...staff, note: "Phoned on Tuesday" }))).toBeUndefined();
      // The seller's own answer and stock LAX owns need no note.
      expect(await code(f.consent({ status: "given", channel: "workspace" }))).toBeUndefined();
      expect(
        await code(f.consent({ status: "not_needed", channel: "house_stock" })),
      ).toBeUndefined();
      expect(await code(f.consent({ status: "lapsed" }))).toBeUndefined();
    });
  });

  it("allows a preferred next step only with a refusal, and only the three known", async () => {
    await withTemporaryDatabase(async (pool) => {
      await runMigrationsPerTransaction(pool);
      const f = await fixture(pool);
      for (const preferredNext of ["later_sale", "return_to_me", "talk_to_us"]) {
        expect(
          await code(f.consent({ status: "refused", channel: "workspace", preferredNext })),
        ).toBeUndefined();
        expect(
          await code(f.consent({ status: "given", channel: "workspace", preferredNext })),
        ).toBe(CHECK);
        expect(await code(f.consent({ status: "requested", preferredNext }))).toBe(CHECK);
      }
      expect(
        await code(
          f.consent({ status: "refused", channel: "workspace", preferredNext: "sell_now" }),
        ),
      ).toBe(CHECK);
      expect(await code(f.consent({ status: "maybe" }))).toBe(CHECK);
      expect(await code(f.consent({ status: "given", channel: "carrier_pigeon" }))).toBe(CHECK);
    });
  });

  it("keeps one request per subject", async () => {
    await withTemporaryDatabase(async (pool) => {
      await runMigrationsPerTransaction(pool);
      const f = await fixture(pool);
      const subject = randomUUID();
      const insert = () =>
        pool.query(
          `insert into seller_consent (subject_type, subject_id, seller_legal_entity_id, lot_id,
             terms_snapshot, status)
           values ('lot_reoffer', $1, $2, $3, '{}'::jsonb, 'requested')`,
          [subject, f.sellerEntityId, f.lotId],
        );
      await insert();
      expect(await code(insert())).toBe(UNIQUE);
    });
  });

  it("allows the six re-offer notices on a notification and still refuses an unknown type", async () => {
    await withTemporaryDatabase(async (pool) => {
      await runMigrationsPerTransaction(pool);
      const f = await fixture(pool);
      const notify = (type: string) =>
        pool.query(
          `insert into notification (user_id, type, title, message) values ($1, $2, 't', 'm')`,
          [f.userId, type],
        );
      for (const type of [
        "reoffer_seller_request",
        "reoffer_seller_reminder",
        "reoffer_seller_outcome",
        "reoffer_offer",
        "reoffer_offer_reminder",
        "reoffer_offer_closed",
        "buyer_default_notice",
        "search_lots_listed",
      ]) {
        expect(await code(notify(type)), type).toBeUndefined();
      }
      expect(await code(notify("reoffer_nonsense"))).toBe(CHECK);
    });
  });

  it("removes a lot's offers and answers with the lot, and keeps the default's columns", async () => {
    await withTemporaryDatabase(async (pool) => {
      await runMigrationsPerTransaction(pool);
      const f = await fixture(pool);
      await f.offer({ status: "declined" });
      await pool.query("delete from lot where id = $1", [f.lotId]);
      for (const table of ["lot_reoffer", "seller_consent", "buyer_default"]) {
        const rows = await pool.query(`select count(*)::int as n from ${table}`);
        expect(rows.rows[0]?.n, table).toBe(0);
      }
      const columns = await pool.query<{ column_name: string }>(
        `select column_name from information_schema.columns
          where table_name = 'buyer_default' and column_name in ('offered_user_id', 'offered_amount')`,
      );
      expect(columns.rows).toHaveLength(2);
    });
  });

  it("can be applied again without harm, and rolled back", async () => {
    await withTemporaryDatabase(async (pool) => {
      await runMigrationsPerTransaction(pool);
      await pool.query(await migrationFile("0354_lot_reoffer.sql"));

      await pool.query(await migrationFile("0354_rollback.sql"));
      const tables = await pool.query(
        `select table_name from information_schema.tables
          where table_name in ('lot_reoffer', 'seller_consent')`,
      );
      expect(tables.rows).toEqual([]);

      const userId = `ro-rb-${randomUUID()}`;
      await pool.query(
        `insert into "user" (id, name, email, email_verified, created_at, updated_at)
         values ($1, $1, $2, true, now(), now())`,
        [userId, `${userId}@integration.test`],
      );
      expect(
        await code(
          pool.query(
            `insert into notification (user_id, type, title, message) values ($1, 'reoffer_offer', 't', 'm')`,
            [userId],
          ),
        ),
      ).toBe(CHECK);
      expect(
        await code(
          pool.query(
            `insert into notification (user_id, type, title, message) values ($1, 'search_lots_listed', 't', 'm')`,
            [userId],
          ),
        ),
      ).toBeUndefined();
    });
  });
});
