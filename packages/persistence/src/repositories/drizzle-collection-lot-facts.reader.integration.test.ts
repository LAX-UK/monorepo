import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DrizzleCollectionLotFactsReader } from "./drizzle-collection-lot-facts.reader.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("collection lot facts (integration)", () => {
  const run = randomUUID().slice(0, 8);
  const winner = `cf-winner-${run}`;
  const heldWinner = `cf-held-${run}`;
  const sofWinner = `cf-sof-${run}`;
  const personalEntity = randomUUID();
  const orgEntity = randomUUID();
  const venueId = randomUUID();
  const saleId = randomUUID();
  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);
  const reader = new DrizzleCollectionLotFactsReader(db);

  let lotNumber = 0;

  type LotOptions = {
    winnerId?: string | null;
    entity?: string;
    status?: string;
    withSale?: boolean;
    payment?: { status: string; createdAt?: string } | null;
  };

  async function lot(
    options: LotOptions = {},
  ): Promise<{ lotId: string; paymentId: string | null }> {
    const lotId = randomUUID();
    lotNumber += 1;
    const entity = options.entity ?? orgEntity;
    const winnerId = options.winnerId === undefined ? winner : options.winnerId;
    await db.execute(sql`
      insert into lot (id, seller_legal_entity_id, sale_id, title, lot_number, auction_type,
         starting_price, current_price, start_time, end_time, status, winner_id, buyer_legal_entity_id)
      values (${lotId}, ${personalEntity}, ${options.withSale === false ? null : saleId},
         ${`Facts lot ${lotId.slice(0, 6)}`}, ${options.withSale === false ? null : lotNumber}, 'english', 100, 100,
         now() - interval '30 days', now() - interval '20 days', ${options.status ?? "ended"},
         ${winnerId}, ${entity})`);
    let paymentId: string | null = null;
    if (options.payment !== null) {
      paymentId = randomUUID();
      const status = options.payment?.status ?? "captured";
      await db.execute(sql`
        insert into payment (id, lot_id, buyer_id, buyer_legal_entity_id, seller_legal_entity_id,
           amount, platform_fee, status, created_at)
        values (${paymentId}, ${lotId}, ${winnerId ?? winner}, ${entity}, ${personalEntity},
           100, 0, ${status}::payment_status, ${options.payment?.createdAt ?? new Date().toISOString()})`);
    }
    return { lotId, paymentId };
  }

  const factsOf = async (lotId: string) => (await reader.read([lotId])).get(lotId);

  beforeAll(async () => {
    const now = new Date();
    await db.execute(sql`
      insert into "user" (id, name, email, email_verified, created_at, updated_at)
      values (${winner}, 'W', ${`${winner}@integration.test`}, true, ${now}, ${now}),
             (${heldWinner}, 'H', ${`${heldWinner}@integration.test`}, true, ${now}, ${now}),
             (${sofWinner}, 'S', ${`${sofWinner}@integration.test`}, true, ${now}, ${now})`);
    await db.execute(sql`
      insert into legal_entity (id, display_name, kind, subkind, created_by_user_id, status)
      values (${personalEntity}, 'Facts personal', 'individual', 'private_collector', ${winner}, 'approved'),
             (${orgEntity}, 'Facts organisation', 'organisation', 'gallery', ${winner}, 'approved')`);
    await db.execute(sql`
      insert into venue (id, legal_entity_id, name, address_line1, city, postcode, country)
      values (${venueId}, ${orgEntity}, 'Facts gallery', '1 Test Street', 'London', 'W1W 6YW', 'GB')`);
    await db.execute(sql`
      insert into sale (id, title, start_time, end_time, venue_id, created_by_legal_entity_id)
      values (${saleId}, 'Facts sale', now() - interval '30 days', now() - interval '20 days', ${venueId}, ${orgEntity})`);
    await db.execute(sql`
      insert into bid_user_profile (user_id, aml_hold_status, created_at, updated_at)
      values (${heldWinner}, 'hold', now(), now())`);
    await db.execute(sql`
      insert into source_of_funds (user_id, status, trigger, threshold_amount, exposure_amount)
      values (${sofWinner}, 'pending', 'manual', 1000, 2000)`);
  });

  afterAll(async () => {
    await db.execute(sql`delete from source_of_funds where user_id = ${sofWinner}`);
    await db.execute(sql`delete from dispute_case where stripe_dispute_id like ${`cf-${run}%`}`);
    await db.execute(sql`delete from lot where seller_legal_entity_id = ${personalEntity}`);
    await db.execute(sql`delete from sale where id = ${saleId}`);
    await db.execute(sql`delete from venue where id = ${venueId}`);
    await db.execute(
      sql`delete from bid_user_profile where user_id in (${winner}, ${heldWinner}, ${sofWinner})`,
    );
    await db.execute(sql`delete from legal_entity where id in (${personalEntity}, ${orgEntity})`);
    await db.execute(sql`delete from "user" where id in (${winner}, ${heldWinner}, ${sofWinner})`);
  });

  it("reads a paid, clear lot: the buyer, the place and nothing in the way", async () => {
    const { lotId } = await lot();
    const record = await factsOf(lotId);
    expect(record).toMatchObject({
      lotId,
      lotNumber: expect.any(Number),
      buyerLegalEntityId: orgEntity,
      buyerAccountKind: "organisation",
      winnerId: winner,
      venueId,
      facts: {
        paymentCleared: true,
        openChecks: [],
        organisationStatus: "approved",
        disputeOpen: false,
        refunded: false,
        refundOpen: false,
        fulfilment: "none",
        activeBookingId: null,
      },
    });
  });

  it("treats only a captured payment as cleared, and the deciding payment over a later failed attempt", async () => {
    for (const status of ["pending", "authorized", "refunded", "cancelled"]) {
      const { lotId } = await lot({ payment: { status } });
      expect((await factsOf(lotId))?.facts.paymentCleared, status).toBe(false);
    }
    const none = await lot({ payment: null });
    expect((await factsOf(none.lotId))?.facts.paymentCleared).toBe(false);

    const retried = await lot({
      payment: { status: "captured", createdAt: "2026-01-01T00:00:00Z" },
    });
    await db.execute(sql`
      insert into payment (lot_id, buyer_id, buyer_legal_entity_id, seller_legal_entity_id,
         amount, platform_fee, status, created_at)
      values (${retried.lotId}, ${winner}, ${orgEntity}, ${personalEntity}, 100, 0,
         'cancelled'::payment_status, now())`);
    expect((await factsOf(retried.lotId))?.facts.paymentCleared).toBe(true);
  });

  it("reports the checks that are open for the buyer", async () => {
    const review = await lot({ payment: { status: "requires_manual_review" } });
    expect((await factsOf(review.lotId))?.facts.openChecks).toEqual(["finance"]);
    const held = await lot({ winnerId: heldWinner });
    expect((await factsOf(held.lotId))?.facts.openChecks).toEqual(["identity"]);
    const sof = await lot({ winnerId: sofWinner });
    expect((await factsOf(sof.lotId))?.facts.openChecks).toEqual(["source_of_funds"]);
  });

  it("reads the organisation's status, and none for a person's own account", async () => {
    await db.execute(sql`update legal_entity set status = 'restricted' where id = ${orgEntity}`);
    try {
      const { lotId } = await lot();
      expect((await factsOf(lotId))?.facts.organisationStatus).toBe("restricted");
    } finally {
      await db.execute(sql`update legal_entity set status = 'approved' where id = ${orgEntity}`);
    }
    const personal = await lot({ entity: personalEntity });
    expect(await factsOf(personal.lotId)).toMatchObject({
      buyerAccountKind: "individual",
      facts: { organisationStatus: null },
    });
  });

  it("sees an open dispute and a refund still being reconciled, and not a closed dispute", async () => {
    const disputed = await lot();
    const closed = await lot();
    const refunding = await lot();
    const caseOf = async (suffix: string, closedAt: string | null) => {
      const id = randomUUID();
      await db.execute(sql`
        insert into dispute_case (id, stripe_dispute_id, stripe_charge_id, amount_pence, currency,
           status, allocation_state, stripe_created_at, last_event_at, closed_at)
        values (${id}, ${`cf-${run}-${suffix}`}, ${`ch_${suffix}`}, 100, 'gbp', 'needs_response',
           'allocated', now(), now(), ${closedAt})`);
      return id;
    };
    const openCase = await caseOf("open", null);
    const closedCase = await caseOf("closed", new Date().toISOString());
    await db.execute(sql`
      insert into dispute_case_candidate (case_id, payment_id)
      values (${openCase}, ${disputed.paymentId}), (${closedCase}, ${closed.paymentId})`);
    await db.execute(sql`
      insert into payment_refund_reconcile (payment_id, payload)
      values (${refunding.paymentId}, '{}'::jsonb)`);

    expect((await factsOf(disputed.lotId))?.facts.disputeOpen).toBe(true);
    expect((await factsOf(closed.lotId))?.facts.disputeOpen).toBe(false);
    expect((await factsOf(refunding.lotId))?.facts.refundOpen).toBe(true);
    await db.execute(sql`
      update payment_refund_reconcile set reconciled_at = now() where payment_id = ${refunding.paymentId}`);
    expect((await factsOf(refunding.lotId))?.facts.refundOpen).toBe(false);
  });

  it("reads how the lot is being fulfilled", async () => {
    const setFulfilment = (lotId: string, status: string, method: string | null) =>
      db.execute(sql`
        insert into lot_fulfilment (lot_id, status, fulfilment_method)
        values (${lotId}, ${status}::lot_fulfilment_status, ${method}::lot_fulfilment_method)`);
    const cancelled = await lot();
    await setFulfilment(cancelled.lotId, "cancelled", null);
    const collected = await lot();
    await setFulfilment(collected.lotId, "delivered", "collection");
    const shipping = await lot();
    await setFulfilment(shipping.lotId, "in_transit", "shipping");
    const ready = await lot();
    await setFulfilment(ready.lotId, "ready_for_collection", "collection");
    const quoted = await lot();
    await db.execute(sql`
      insert into delivery_quote (lot_id, buyer_legal_entity_id, status, destination, amount)
      values (${quoted.lotId}, ${orgEntity}, 'accepted', '12 Gallery Row', 85)`);

    expect((await factsOf(cancelled.lotId))?.facts.fulfilment).toBe("cancelled");
    expect((await factsOf(collected.lotId))?.facts.fulfilment).toBe("collected");
    expect((await factsOf(shipping.lotId))?.facts.fulfilment).toBe("courier");
    expect((await factsOf(ready.lotId))?.facts.fulfilment).toBe("none");
    expect((await factsOf(quoted.lotId))?.facts.fulfilment).toBe("courier");
  });

  it("names the live booking that holds the lot", async () => {
    const held = await lot();
    const bookingId = randomUUID();
    await db.execute(sql`
      insert into collection_booking (id, legal_entity_id, venue_id, slot_start, slot_end, seat,
         collector_kind, collector_name, idempotency_key, request_fingerprint)
      values (${bookingId}, ${orgEntity}, ${venueId}, '2035-01-01T10:00:00Z', '2035-01-01T10:30:00Z',
         1, 'self', 'Maya', ${randomUUID()}, 'f')`);
    await db.execute(sql`
      insert into collection_booking_lot (booking_id, lot_id) values (${bookingId}, ${held.lotId})`);
    try {
      expect((await factsOf(held.lotId))?.facts.activeBookingId).toBe(bookingId);
      await db.execute(
        sql`update collection_booking_lot set active = false where booking_id = ${bookingId}`,
      );
      expect((await factsOf(held.lotId))?.facts.activeBookingId).toBeNull();
    } finally {
      await db.execute(sql`delete from collection_booking_lot where booking_id = ${bookingId}`);
      await db.execute(sql`delete from collection_booking where id = ${bookingId}`);
    }
  });

  it("leaves out a lot that is not won, not ended, or unknown, and says there is no place without a sale", async () => {
    const unwon = await lot({ winnerId: null });
    const live = await lot({ status: "active" });
    expect((await reader.read([unwon.lotId, live.lotId, randomUUID()])).size).toBe(0);
    const noSale = await lot({ withSale: false });
    expect((await factsOf(noSale.lotId))?.venueId).toBeNull();
    expect((await reader.read([])).size).toBe(0);
  });

  it("reads many lots in one go", async () => {
    const a = await lot();
    const b = await lot({ payment: { status: "pending" } });
    const found = await reader.read([a.lotId, b.lotId, a.lotId]);
    expect([...found.keys()].sort()).toEqual([a.lotId, b.lotId].sort());
    expect(found.get(b.lotId)?.facts.paymentCleared).toBe(false);
  });
});
