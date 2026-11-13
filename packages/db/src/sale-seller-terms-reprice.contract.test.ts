import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildPgConnectionConfig } from "./ssl.js";

const OWNER_URL = process.env.DATABASE_URL_OWNER;
const ROLE_URLS = [
  ["api_app", process.env.DATABASE_URL_API ?? process.env.API_APP_DATABASE_URL],
  ["worker_app", process.env.DATABASE_URL_WORKER ?? process.env.WORKER_APP_DATABASE_URL],
] as const;
const { Client } = pg;

/** What Postgres reports when a statement fails, or `null` when it succeeds. */
async function failure(client: pg.Client, text: string, values: unknown[]) {
  try {
    await client.query(text, values);
    return null;
  } catch (error) {
    return (error as { code?: string }).code ?? "unknown";
  }
}

/**
 * Settlement re-prices a held sale over its seller-terms row (migration 0374). The grant lets the
 * application roles write the figure columns; the row guard lets them write only a held row, so a
 * snapshot that is priced (and has been or will be paid from) is never rewritten.
 */
describe.skipIf(!OWNER_URL || ROLE_URLS.every(([, url]) => !url))(
  "sale_seller_terms re-pricing is limited to held rows",
  { timeout: 60_000 },
  () => {
    const owner = new Client(buildPgConnectionConfig(OWNER_URL as string));
    const userId = `terms-guard-${randomUUID()}`;
    const ids: { sellerId?: string; buyerId?: string; lots: string[]; payments: string[] } = {
      lots: [],
      payments: [],
    };
    let heldId = "";
    let pricedId = "";

    const one = async (text: string, values: unknown[]) =>
      (await owner.query<{ id: string }>(text, values)).rows[0]?.id as string;

    async function seedTerms(basis: "held" | "lax_owned"): Promise<string> {
      const lotId = await one(
        `insert into lot (title, auction_type, starting_price, current_price, start_time, end_time, seller_legal_entity_id)
         values ('Guard lot', 'english', 0, 0, now(), now() + interval '1 day', $1) returning id`,
        [ids.sellerId],
      );
      ids.lots.push(lotId);
      const paymentId = await one(
        `insert into payment (lot_id, buyer_id, buyer_legal_entity_id, seller_legal_entity_id, amount, platform_fee)
         values ($1, $2, $3, $4, 1250, 62.5) returning id`,
        [lotId, userId, ids.buyerId, ids.sellerId],
      );
      ids.payments.push(paymentId);
      return one(
        `insert into sale_seller_terms (payment_id, lot_id, seller_legal_entity_id, basis, held_reason, hammer_pence, premium_pence, rule_version)
         values ($1, $2, $3, $4, $5, 100000, 25000, 'agreement_hammer_v1') returning id`,
        [paymentId, lotId, ids.sellerId, basis, basis === "held" ? "no_agreement" : null],
      );
    }

    beforeAll(async () => {
      await owner.connect();
      await owner.query(
        `insert into "user" (id, name, email, created_at, updated_at)
         values ($1, 'Terms guard', $2, now(), now())`,
        [userId, `${userId}@example.test`],
      );
      ids.sellerId = await one(
        `insert into legal_entity (kind, subkind, display_name, created_by_user_id)
         values ('organisation', 'gallery', $1, $2) returning id`,
        [`Guard seller ${userId}`, userId],
      );
      ids.buyerId = await one(
        `insert into legal_entity (kind, subkind, display_name, created_by_user_id)
         values ('individual', 'private_collector', $1, $2) returning id`,
        [`Guard buyer ${userId}`, userId],
      );
      heldId = await seedTerms("held");
      pricedId = await seedTerms("lax_owned");
    });

    afterAll(async () => {
      if (ids.payments.length) {
        await owner.query("delete from sale_seller_terms where payment_id = any($1::uuid[])", [
          ids.payments,
        ]);
        await owner.query("delete from payment where id = any($1::uuid[])", [ids.payments]);
      }
      if (ids.lots.length) {
        await owner.query("delete from lot where id = any($1::uuid[])", [ids.lots]);
      }
      await owner.query("delete from legal_entity where id = any($1::uuid[])", [
        [ids.sellerId, ids.buyerId].filter(Boolean),
      ]);
      await owner.query(`delete from "user" where id = $1`, [userId]);
      await owner.end();
    });

    for (const [role, url] of ROLE_URLS) {
      it.skipIf(!url)(`${role} may re-price a held row and no other`, async () => {
        const client = new Client(buildPgConnectionConfig(url as string));
        await client.connect();
        try {
          const touch = "update sale_seller_terms set computed_at = now() where id = $1";
          expect(await failure(client, touch, [heldId])).toBeNull();
          // A priced row is refused by the row guard, though the column itself is granted.
          expect(await failure(client, touch, [pricedId])).toBe("23001");
          expect(
            await failure(
              client,
              "update sale_seller_terms set basis = 'held', held_reason = 'no_agreement' where id = $1",
              [pricedId],
            ),
          ).toBe("23001");
          const [row] = (
            await owner.query<{ basis: string }>(
              "select basis from sale_seller_terms where id = $1",
              [pricedId],
            )
          ).rows;
          expect(row?.basis).toBe("lax_owned");
        } finally {
          await client.end();
        }
      });
    }

    it("refuses the owner too: a priced snapshot is never rewritten", async () => {
      expect(
        await failure(owner, "update sale_seller_terms set computed_at = now() where id = $1", [
          pricedId,
        ]),
      ).toBe("23001");
    });
  },
);
