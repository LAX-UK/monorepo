import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import {
  legalEntity,
  lot,
  payment,
  paymentCheckoutSession,
  paymentGroup,
  user,
} from "@auction/db/schema";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { DrizzlePaymentCheckoutSessionRepository } from "./drizzle-payment-checkout-session.repository.js";
import { DrizzleStalePaymentCanceller } from "./drizzle-stale-payment-canceller.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("stale payment cancel statement (integration)", () => {
  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);
  const canceller = new DrizzleStalePaymentCanceller(db);
  const sessions = new DrizzlePaymentCheckoutSessionRepository(db);
  const run = randomUUID().slice(0, 8);
  const buyerId = `spc-buyer-${run}`;
  const entityId = randomUUID();
  const lotId = randomUUID();
  let paymentId: string;

  beforeAll(async () => {
    const now = new Date();
    await db.insert(user).values({
      id: buyerId,
      name: "Buyer",
      email: `${buyerId}@integration.test`,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(legalEntity).values({
      id: entityId,
      displayName: "Buyer",
      kind: "individual",
      subkind: "private_collector",
      createdByUserId: buyerId,
      status: "approved",
    });
    await db.insert(lot).values({
      id: lotId,
      title: "Work",
      images: [],
      auctionType: "english",
      startingPrice: "10.00",
      currentPrice: "100.00",
      minBidIncrement: "10.00",
      startTime: new Date(now.getTime() - 3 * 86_400_000),
      endTime: new Date(now.getTime() - 86_400_000),
      status: "ended",
      sellerLegalEntityId: entityId,
      winnerId: buyerId,
      buyerLegalEntityId: entityId,
    });
  });

  beforeEach(async () => {
    await db.delete(payment).where(eq(payment.lotId, lotId));
    const [row] = await db
      .insert(payment)
      .values({
        lotId,
        buyerId,
        buyerLegalEntityId: entityId,
        sellerLegalEntityId: entityId,
        amount: "100.00",
        platformFee: "5.00",
        status: "pending",
      })
      .returning({ id: payment.id });
    paymentId = row?.id as string;
  });

  afterAll(async () => {
    await db.delete(payment).where(eq(payment.lotId, lotId));
    await db.delete(paymentGroup).where(eq(paymentGroup.buyerLegalEntityId, entityId));
    await db.delete(lot).where(eq(lot.id, lotId));
    await db.delete(legalEntity).where(inArray(legalEntity.id, [entityId]));
    await db.delete(user).where(eq(user.id, buyerId));
  });

  const statusOf = async () =>
    (await db.select({ status: payment.status }).from(payment).where(eq(payment.id, paymentId)))[0]
      ?.status;

  it("cancels an unpaid invoice nothing touched since the check began", async () => {
    await sessions.record(paymentId, `cs_spc_${run}_old`);
    const since = await canceller.now();
    expect(await canceller.cancelIfUntouchedSince(paymentId, since)).toBe(true);
    expect(await statusOf()).toBe("cancelled");
  });

  it("does not cancel when a checkout was opened after the check began", async () => {
    const since = await canceller.now();
    await sessions.record(paymentId, `cs_spc_${run}_new`);
    expect(await canceller.cancelIfUntouchedSince(paymentId, since)).toBe(false);
    expect(await statusOf()).toBe("pending");
  });

  it("does not cancel an invoice held by a Pay several payment", async () => {
    const [group] = await db
      .insert(paymentGroup)
      .values({
        buyerLegalEntityId: entityId,
        createdByUserId: buyerId,
        currency: "GBP",
        totalAmount: "100.00",
        checkoutRail: "card",
        status: "open",
      })
      .returning({ id: paymentGroup.id });
    await db.update(payment).set({ paymentGroupId: group?.id }).where(eq(payment.id, paymentId));
    const since = await canceller.now();
    expect(await canceller.cancelIfUntouchedSince(paymentId, since)).toBe(false);
    await db.update(payment).set({ paymentGroupId: null }).where(eq(payment.id, paymentId));
  });

  it("does not cancel an invoice that was paid meanwhile", async () => {
    await db.update(payment).set({ status: "captured" }).where(eq(payment.id, paymentId));
    expect(await canceller.cancelIfUntouchedSince(paymentId, await canceller.now())).toBe(false);
    expect(await statusOf()).toBe("captured");
  });

  it("lists an unpaid invoice once it has a checkout, with who pays it", async () => {
    const before = await canceller.listUnpaidWithCheckout(500);
    expect(before.some((r) => r.id === paymentId)).toBe(false);
    await sessions.record(paymentId, `cs_spc_${run}_list`);
    const after = await canceller.listUnpaidWithCheckout(500);
    expect(after).toContainEqual({
      id: paymentId,
      payerUserId: buyerId,
      buyerLegalEntityId: entityId,
    });
    await db.update(payment).set({ status: "captured" }).where(eq(payment.id, paymentId));
    const paid = await canceller.listUnpaidWithCheckout(500);
    expect(paid.some((r) => r.id === paymentId)).toBe(false);
  });

  it("removes the checkout sessions with their payment", async () => {
    await sessions.record(paymentId, `cs_spc_${run}_gone`);
    await db.delete(payment).where(eq(payment.id, paymentId));
    const left = await db
      .select()
      .from(paymentCheckoutSession)
      .where(eq(paymentCheckoutSession.paymentId, paymentId));
    expect(left).toEqual([]);
  });
});
