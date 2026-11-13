import { randomUUID } from "node:crypto";
import { type Database, createDb } from "@auction/db";
import { legalEntity, lot, payment, paymentGroup, user } from "@auction/db/schema";
import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DrizzleDisputeCaseRepository } from "./drizzle-dispute-case.repository.js";
import { DrizzlePaymentGroupRepository } from "./drizzle-payment-group.repository.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

/**
 * A dispute over several invoices and a refund of the group they were paid in both hold the
 * invoices' payments before any payout. They take them in the same order (payment id), so neither
 * can hold one invoice while it waits for the other's.
 */
describe.skipIf(!HAS_DB)("payment lock order: group refund and dispute (integration)", () => {
  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const url = process.env.DATABASE_URL!;
  const db = createDb(url);
  const groups = new DrizzlePaymentGroupRepository(db);
  const disputes = new DrizzleDisputeCaseRepository(db);
  const payerId = `lock-order-payer-${randomUUID()}`;
  const buyerId = randomUUID();
  const sellerId = randomUUID();
  const lotIds = [randomUUID(), randomUUID()];
  let low: string;
  let high: string;
  let groupId: string;

  beforeAll(async () => {
    const now = new Date();
    await db.insert(user).values({
      id: payerId,
      name: "Payer",
      email: `${payerId}@integration.test`,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(legalEntity).values([
      {
        id: buyerId,
        displayName: "Lock Order Buyer",
        kind: "organisation",
        subkind: "gallery",
        createdByUserId: payerId,
        status: "approved",
      },
      {
        id: sellerId,
        displayName: "Lock Order Seller",
        kind: "individual",
        subkind: "private_collector",
        createdByUserId: payerId,
        status: "approved",
      },
    ]);
    await db.insert(lot).values(
      lotIds.map((id, i) => ({
        id,
        title: `Lock order ${i}`,
        images: [],
        auctionType: "english" as const,
        startingPrice: "10.00",
        currentPrice: "100.00",
        minBidIncrement: "10.00",
        startTime: new Date(now.getTime() - 3 * 86_400_000),
        endTime: new Date(now.getTime() - 86_400_000),
        status: "ended" as const,
        sellerLegalEntityId: sellerId,
        winnerId: payerId,
        buyerLegalEntityId: buyerId,
      })),
    );
    const rows = await db
      .insert(payment)
      .values(
        lotIds.map((lotId) => ({
          lotId,
          buyerId: payerId,
          buyerLegalEntityId: buyerId,
          sellerLegalEntityId: sellerId,
          amount: "100.00",
          platformFee: "5.00",
          status: "pending" as const,
        })),
      )
      .returning({ id: payment.id });
    [low, high] = rows.map((r) => r.id).sort() as [string, string];
    const claimed = await groups.claim({
      buyerLegalEntityId: buyerId,
      createdByUserId: payerId,
      currency: "GBP",
      totalAmount: "200.00",
      checkoutRail: "card",
      paymentIds: [low, high],
      deliveries: [],
    });
    if (claimed.kind !== "claimed") throw new Error("expected a claim");
    groupId = claimed.group.id;
  });

  afterAll(async () => {
    await db.delete(payment).where(inArray(payment.lotId, lotIds));
    await db.delete(paymentGroup).where(eq(paymentGroup.buyerLegalEntityId, buyerId));
    await db.delete(lot).where(inArray(lot.id, lotIds));
    await db.delete(legalEntity).where(inArray(legalEntity.id, [buyerId, sellerId]));
    await db.delete(user).where(eq(user.id, payerId));
  });

  /** "ok", or the SQLSTATE a transaction failed with (40P01 is a deadlock). */
  const sqlStateOf = (outcome: PromiseSettledResult<unknown>): string =>
    outcome.status === "fulfilled"
      ? "ok"
      : ((outcome.reason as { cause?: { code?: string } }).cause?.code ?? String(outcome.reason));

  /** Waits until `count` connections are queued for a payment row lock. */
  async function queuedForPayments(count: number): Promise<void> {
    for (let i = 0; i < 100; i++) {
      const { rows } = await db.execute(
        sql`SELECT 1 FROM pg_stat_activity
            WHERE wait_event_type = 'Lock' AND query ILIKE '%from "payment"%for update%'`,
      );
      if (rows.length >= count) return;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error(`expected ${count} connections queued for a payment lock`);
  }

  it("lets a group refund and a two-invoice dispute queued on the same invoice both finish", async () => {
    // A single refund holds the lower invoice.
    const holder = createDb(url);
    let release!: () => void;
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    let held!: () => void;
    const isHeld = new Promise<void>((resolve) => {
      held = resolve;
    });
    const refund = holder.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM payment WHERE id = ${low} FOR UPDATE`);
      held();
      await released;
    });
    await isHeld;

    // The group refund queues first, holding the group; then the dispute, asking for the invoices
    // in the other order.
    const groupRefund = createDb(url).transaction(async (tx) => {
      await groups.lockInTransaction(tx as unknown as Database, groupId);
    });
    await queuedForPayments(1);
    const dispute = createDb(url).transaction(async (tx) => {
      await disputes.lockPaymentsInTransaction(tx as unknown as Database, [high, low]);
    });
    await queuedForPayments(2);

    release();
    await refund;
    const outcomes = await Promise.allSettled([groupRefund, dispute]);

    // In payment id order, the dispute holds nothing while it waits for the lower invoice. In
    // the other order it would hold the higher one, which the group refund needs next: deadlock.
    expect(outcomes.map(sqlStateOf)).toEqual(["ok", "ok"]);
  });
});
