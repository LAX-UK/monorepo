import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { legalEntity, lot, payment, paymentGroup, user } from "@auction/db/schema";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  DrizzlePaySeveralInvoiceFlagsReader,
  DrizzlePaymentGroupRepository,
} from "./drizzle-payment-group.repository.js";
import { DrizzlePaymentRepository } from "./drizzle-payment.repository.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("payment groups (integration)", () => {
  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);
  const groups = new DrizzlePaymentGroupRepository(db);
  const flags = new DrizzlePaySeveralInvoiceFlagsReader(db);
  const payments = new DrizzlePaymentRepository(db);

  const payerId = `pg-payer-${randomUUID()}`;
  const orgId = randomUUID();
  const otherOrgId = randomUUID();
  const sellerId = randomUUID();
  const closedSellerId = randomUUID();
  const lotIds = Array.from({ length: 4 }, () => randomUUID());
  const now = new Date("2026-11-10T12:00:00Z");
  let paymentIds: string[] = [];

  const claimInput = (ids: readonly string[], buyer = orgId) => ({
    buyerLegalEntityId: buyer,
    createdByUserId: payerId,
    currency: "GBP",
    totalAmount: "300.00",
    checkoutRail: "card" as const,
    paymentIds: ids,
  });

  beforeAll(async () => {
    await db.insert(user).values({
      id: payerId,
      name: "Payer",
      email: `${payerId}@integration.test`,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(legalEntity).values(
      [
        [orgId, "organisation", "gallery", "approved"],
        [otherOrgId, "organisation", "gallery", "approved"],
        [sellerId, "individual", "private_collector", "approved"],
        [closedSellerId, "individual", "private_collector", "archived"],
      ].map(([id, kind, subkind, status]) => ({
        id: id as string,
        displayName: `Entity ${(id as string).slice(0, 4)}`,
        kind: kind as "organisation" | "individual",
        subkind: subkind as "gallery" | "private_collector",
        createdByUserId: payerId,
        status: status as "approved" | "archived",
      })),
    );
    await db.insert(lot).values(
      lotIds.map((id, i) => ({
        id,
        title: `Grouped ${i}`,
        images: [],
        auctionType: "english" as const,
        startingPrice: "10.00",
        currentPrice: "100.00",
        minBidIncrement: "10.00",
        startTime: new Date(now.getTime() - 3 * 86_400_000),
        endTime: new Date(now.getTime() - 86_400_000),
        status: "ended" as const,
        sellerLegalEntityId: i === 3 ? closedSellerId : sellerId,
        winnerId: payerId,
        buyerLegalEntityId: orgId,
      })),
    );
  });

  beforeEach(async () => {
    await db.delete(payment).where(inArray(payment.lotId, lotIds));
    await db.delete(paymentGroup).where(inArray(paymentGroup.buyerLegalEntityId, [orgId]));
    const rows = await db
      .insert(payment)
      .values(
        lotIds.map((lotId, i) => ({
          lotId,
          buyerId: payerId,
          buyerLegalEntityId: orgId,
          sellerLegalEntityId: i === 3 ? closedSellerId : sellerId,
          amount: "100.00",
          platformFee: "5.00",
          status: "pending" as const,
        })),
      )
      .returning({ id: payment.id, lotId: payment.lotId });
    paymentIds = lotIds.map((lotId) => rows.find((r) => r.lotId === lotId)?.id as string);
  });

  afterAll(async () => {
    await db.delete(payment).where(inArray(payment.lotId, lotIds));
    await db.delete(paymentGroup).where(inArray(paymentGroup.buyerLegalEntityId, [orgId]));
    await db.delete(lot).where(inArray(lot.id, lotIds));
    await db
      .delete(legalEntity)
      .where(inArray(legalEntity.id, [orgId, otherOrgId, sellerId, closedSellerId]));
    await db.delete(user).where(eq(user.id, payerId));
  });

  const groupOf = async (paymentId: string) =>
    (await payments.findById(paymentId))?.paymentGroupId ?? null;

  it("takes every invoice into the group, or none of them", async () => {
    const [a, b, c] = paymentIds as [string, string, string];
    const claimed = await groups.claim(claimInput([a, b]));
    if (claimed.kind !== "claimed") throw new Error("expected a claim");
    expect(await groupOf(a)).toBe(claimed.group.id);
    expect(await groupOf(b)).toBe(claimed.group.id);
    expect(claimed.group.status).toBe("open");

    // b is taken, so a second group over b and c takes nothing and leaves no group behind.
    expect(await groups.claim(claimInput([b, c]))).toEqual({ kind: "conflict" });
    expect(await groupOf(c)).toBeNull();
    const left = await db
      .select({ id: paymentGroup.id })
      .from(paymentGroup)
      .where(eq(paymentGroup.buyerLegalEntityId, orgId));
    expect(left).toHaveLength(1);
  });

  it("lets exactly one of two concurrent claims over the same invoices win", async () => {
    const [a, b, c] = paymentIds as [string, string, string];
    const results = await Promise.all([
      groups.claim(claimInput([a, b])),
      groups.claim(claimInput([b, c])),
      groups.claim(claimInput([c, a])),
    ]);
    const winners = results.filter((r) => r.kind === "claimed");
    expect(winners).toHaveLength(1);
    const winner = winners[0];
    if (winner?.kind !== "claimed") throw new Error("expected a winner");
    const members = await groups.listMembers(winner.group.id);
    expect(members).toHaveLength(2);
    for (const id of [a, b, c]) {
      const group = await groupOf(id);
      expect(group === null || group === winner.group.id).toBe(true);
    }
  });

  it("never takes an invoice a single payment settled first, even mid-transaction", async () => {
    const [a, b] = paymentIds as [string, string];
    // The single-invoice capture holds a's row lock while the group tries to take it.
    let releaseCapture: () => void = () => {};
    const captureHeld = new Promise<void>((resolve) => {
      releaseCapture = resolve;
    });
    let captureStarted: () => void = () => {};
    const started = new Promise<void>((resolve) => {
      captureStarted = resolve;
    });
    const capture = db.transaction(async (tx) => {
      await payments.applyCapturedInTransaction(tx, a, { stripeChargeId: `ch_${randomUUID()}` });
      captureStarted();
      await captureHeld;
    });
    await started;
    const claim = groups.claim(claimInput([a, b]));
    setTimeout(releaseCapture, 100);
    await capture;
    expect(await claim).toEqual({ kind: "conflict" });
    expect(await groupOf(b)).toBeNull();
  });

  it("refuses invoices of another account", async () => {
    const [a] = paymentIds as [string];
    expect(await groups.claim(claimInput([a], otherOrgId))).toEqual({ kind: "conflict" });
  });

  it("finds a group by its PaymentIntent or charge and lets members share the charge", async () => {
    const [a, b] = paymentIds as [string, string];
    const claimed = await groups.claim(claimInput([a, b]));
    if (claimed.kind !== "claimed") throw new Error("expected a claim");
    const pi = `pi_${randomUUID()}`;
    const charge = `ch_${randomUUID()}`;
    await groups.recordCheckout(claimed.group.id, { sessionId: "cs_1", paymentIntentId: pi });
    expect((await payments.findById(a))?.stripePaymentIntentId).toBe(pi);
    await db.transaction(async (tx) => {
      await payments.applyCapturedInTransaction(tx, a, { stripeChargeId: charge });
      await payments.applyCapturedInTransaction(tx, b, { stripeChargeId: charge });
      expect(
        await groups.transitionInTransaction(tx, claimed.group.id, ["open"], "paid", {
          stripeChargeId: charge,
        }),
      ).toBe(true);
    });
    expect((await groups.findByStripeRefs({ paymentIntentId: pi }))?.id).toBe(claimed.group.id);
    const paid = await groups.findByStripeRefs({ chargeId: charge });
    expect(paid?.status).toBe("paid");
    expect(paid?.settledAt).toBeInstanceOf(Date);
  });

  it("moves only from the expected status, so a late event changes nothing", async () => {
    const [a] = paymentIds as [string];
    const claimed = await groups.claim(claimInput([a]));
    if (claimed.kind !== "claimed") throw new Error("expected a claim");
    const id = claimed.group.id;
    await db.transaction(async (tx) => {
      expect(await groups.transitionInTransaction(tx, id, ["open"], "processing")).toBe(true);
      expect(await groups.transitionInTransaction(tx, id, ["open"], "processing")).toBe(false);
      expect(await groups.transitionInTransaction(tx, id, ["open", "processing"], "paid")).toBe(
        true,
      );
      expect(
        await groups.transitionInTransaction(tx, id, ["open", "processing"], "cancelled"),
      ).toBe(false);
    });
  });

  it("hands every open invoice back when a group is released, so it can be paid again", async () => {
    const [a, b, c] = paymentIds as [string, string, string];
    const claimed = await groups.claim(claimInput([a, b]));
    if (claimed.kind !== "claimed") throw new Error("expected a claim");
    await db.transaction(async (tx) => {
      await payments.applyAuthorizedInTransaction(tx, b);
      const locked = await groups.lockInTransaction(tx, claimed.group.id);
      expect(locked?.members.map((m) => m.paymentId).sort()).toEqual([a, b].sort());
      await groups.transitionInTransaction(tx, claimed.group.id, ["open"], "cancelled");
      expect((await groups.releaseMembersInTransaction(tx, claimed.group.id)).sort()).toEqual(
        [a, b].sort(),
      );
    });
    for (const id of [a, b]) {
      const row = await payments.findById(id);
      expect(row?.status).toBe("pending");
      expect(row?.paymentGroupId).toBeNull();
    }
    // One open payment per lot still holds, and the invoices can join a new group.
    expect((await groups.claim(claimInput([a, b, c]))).kind).toBe("claimed");
  });

  it("flags invoices held for review and those already in an open payment", async () => {
    const [a, b, , held] = paymentIds as [string, string, string, string];
    await groups.claim(claimInput([a]));
    const result = await flags.flagsFor([a, b, held]);
    expect(result.get(a)).toEqual({ heldForReview: false, inPaymentInProgress: true });
    expect(result.get(b)).toEqual({ heldForReview: false, inPaymentInProgress: false });
    expect(result.get(held)).toEqual({ heldForReview: true, inPaymentInProgress: false });
  });

  it("leaves grouped payments out of the stale-payment expiry", async () => {
    const [a, b] = paymentIds as [string, string];
    await groups.claim(claimInput([a]));
    const stale = await payments.listStalePendingBefore(new Date(Date.now() + 60_000));
    const ids = stale.map((s) => s.id);
    expect(ids).toContain(b);
    expect(ids).not.toContain(a);
  });
});
