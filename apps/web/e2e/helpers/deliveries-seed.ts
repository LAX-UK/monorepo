import { randomUUID } from "node:crypto";
import pg from "pg";
import { e2eEnabled, hasStaffCredentials } from "./auth";

/**
 * Made-up delivery requests for the Deliveries journeys (docs/design/staff-gaps-delivery-zoho-
 * alerts.md, GAP-47): a buyer and seller, a closed sale, and lots the buyer won, each with a
 * request for a delivery price to a made-up address carrying the journey's tag. Every journey
 * makes its own and removes them afterwards, so none depends on demo data or skips for want of it.
 */
export type SeededDeliveries = {
  userId: string;
  entityIds: string[];
  saleId: string;
  lotIds: string[];
};

/** Fails, never skips, when the run cannot reach what the journey needs. */
export function requireDeliveriesStack(): void {
  if (!e2eEnabled)
    throw new Error("Set PLAYWRIGHT_E2E=1 and start the e2e stack to run Deliveries");
  if (!hasStaffCredentials()) {
    throw new Error("PLAYWRIGHT_STAFF_EMAIL and PLAYWRIGHT_STAFF_PASSWORD are required");
  }
}

export function deliveriesDatabase(): pg.Client {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required to add the journey's requests");
  return new pg.Client({ connectionString });
}

/**
 * `count` won lots, each with a request asked `index + 2` hours ago. The made-up buyer member
 * asked for them (`requested_by_user_id`), so a quote reaches them as a notice.
 */
export async function seedDeliveryRequests(
  tag: string,
  options: { count?: number; firstLotNumber?: number; titlePrefix?: string } = {},
): Promise<SeededDeliveries> {
  const count = options.count ?? 2;
  const firstLotNumber = options.firstLotNumber ?? 900;
  const titlePrefix = options.titlePrefix ?? "Harbour study";
  const client = deliveriesDatabase();
  await client.connect();
  const userId = `e2e-deliveries-${randomUUID().slice(0, 8)}`;
  const [seller, buyer] = [randomUUID(), randomUUID()];
  const saleId = randomUUID();
  const lotIds = Array.from({ length: count }, () => randomUUID());
  try {
    await client.query("begin");
    await client.query(
      `insert into "user" (id, name, email, email_verified, created_at, updated_at)
       values ($1, $1, $2, true, now(), now())`,
      [userId, `${userId}@example.test`],
    );
    await client.query(
      "insert into bid_user_profile (user_id, created_at, updated_at) values ($1, now(), now())",
      [userId],
    );
    for (const [id, name] of [
      [seller, `Example Seller ${tag}`],
      [buyer, `Example Buyer ${tag}`],
    ] as const) {
      await client.query(
        `insert into legal_entity (id, display_name, kind, subkind, created_by_user_id, status)
         values ($1, $2, 'organisation', 'gallery', $3, 'approved')`,
        [id, name, userId],
      );
    }
    await client.query(
      `insert into sale (id, title, start_time, end_time, created_by_legal_entity_id)
       values ($1, $2, now() - interval '2 days', now() - interval '1 day', $3)`,
      [saleId, `Example sale ${tag}`, seller],
    );
    for (const [index, lotId] of lotIds.entries()) {
      await client.query(
        `insert into lot (id, seller_legal_entity_id, sale_id, lot_number, title, auction_type,
           starting_price, current_price, start_time, end_time, status, winner_id,
           buyer_legal_entity_id)
         values ($1, $2, $3, $4, $5, 'english', 100, 1250, now() - interval '2 days',
           now() - interval '1 day', 'ended', $6, $7)`,
        [
          lotId,
          seller,
          saleId,
          firstLotNumber + index,
          `${titlePrefix} ${index + 1}`,
          userId,
          buyer,
        ],
      );
      await client.query(
        `insert into delivery_quote (lot_id, buyer_legal_entity_id, status, destination,
           requested_by_user_id, requested_at)
         values ($1, $2, 'requested', $3, $4, now() - ($5 || ' hours')::interval)`,
        [lotId, buyer, `${index + 1} Example Lane, ${tag}, France`, userId, String(index + 2)],
      );
    }
    await client.query("commit");
    return { userId, entityIds: [buyer, seller], saleId, lotIds };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
}

export async function removeDeliveryRequests(seeded: SeededDeliveries | null): Promise<void> {
  if (!seeded) return;
  const client = deliveriesDatabase();
  await client.connect();
  try {
    await client.query("delete from notification where user_id = $1", [seeded.userId]);
    await client.query("delete from delivery_quote where lot_id = any($1::uuid[])", [
      seeded.lotIds,
    ]);
    await client.query("delete from lot where id = any($1::uuid[])", [seeded.lotIds]);
    await client.query("delete from sale where id = $1", [seeded.saleId]);
    await client.query("delete from legal_entity where id = any($1::uuid[])", [seeded.entityIds]);
    await client.query("delete from bid_user_profile where user_id = $1", [seeded.userId]);
    await client.query('delete from "user" where id = $1', [seeded.userId]);
  } finally {
    await client.end();
  }
}

/** The quote as stored, for the journey to check what the route wrote. */
export async function readDeliveryQuote(
  lotId: string,
): Promise<{ status: string; amount: string | null; quoteNote: string | null } | null> {
  const client = deliveriesDatabase();
  await client.connect();
  try {
    const result = await client.query<{
      status: string;
      amount: string | null;
      quote_note: string | null;
    }>(
      `select status, amount::text as amount, quote_note from delivery_quote
        where lot_id = $1 order by requested_at desc limit 1`,
      [lotId],
    );
    const row = result.rows[0];
    return row ? { status: row.status, amount: row.amount, quoteNote: row.quote_note } : null;
  } finally {
    await client.end();
  }
}

/** The buyer's notices that a quote is ready, newest first (their messages carry the price). */
export async function readQuoteReadyNotices(userId: string, lotId: string): Promise<string[]> {
  const client = deliveriesDatabase();
  await client.connect();
  try {
    const result = await client.query<{ message: string }>(
      `select message from notification
        where user_id = $1 and lot_id = $2 and type = 'delivery_quote_ready'
        order by created_at desc`,
      [userId, lotId],
    );
    return result.rows.map((row) => row.message);
  } finally {
    await client.end();
  }
}

/** The buyer withdraws, as if from their purchase page while staff are pricing it. */
export async function withdrawDeliveryRequest(lotId: string): Promise<void> {
  const client = deliveriesDatabase();
  await client.connect();
  try {
    await client.query(
      `update delivery_quote set status = 'withdrawn', decided_at = now(), updated_at = now()
        where lot_id = $1 and status in ('requested', 'quoted')`,
      [lotId],
    );
  } finally {
    await client.end();
  }
}

/**
 * The buyer accepts the quote and the lot reaches `status` on Lot fulfilment, by courier: what
 * To dispatch (`released`), On the way (`in_transit`) and Delivered (`delivered`) are made of.
 * Removing the lot removes its fulfilment with it.
 */
export async function bookDelivery(
  lotId: string,
  status: "awaiting_release" | "released" | "in_transit" | "delivered",
): Promise<void> {
  const client = deliveriesDatabase();
  await client.connect();
  try {
    await client.query("begin");
    await client.query(
      `update delivery_quote
          set status = 'accepted', amount = 180, quote_note = 'Insured, two-person delivery',
              quoted_at = now() - interval '1 hour', decided_at = now() - interval '30 minutes',
              updated_at = now()
        where lot_id = $1`,
      [lotId],
    );
    const shipped = status === "in_transit" || status === "delivered";
    await client.query(
      `insert into lot_fulfilment (lot_id, status, fulfilment_method, shipping_carrier,
         tracking_number, payment_cleared_at)
       values ($1, $2, 'shipping', $3, $4, now() - interval '20 minutes')`,
      [lotId, status, shipped ? "Example Couriers" : null, shipped ? "EX123456789GB" : null],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
}
