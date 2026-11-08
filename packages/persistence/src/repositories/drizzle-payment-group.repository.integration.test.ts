import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import {
  deliveryQuote,
  legalEntity,
  lot,
  payment,
  paymentGroup,
  paymentGroupDelivery,
  user,
} from "@auction/db/schema";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  DrizzleChargeableDeliveryReader,
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
  const chargeable = new DrizzleChargeableDeliveryReader(db);
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
    deliveries: [],
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

  /** Removes courier quotes and what charged them, which hold groups and lots. */
  const clearDelivery = async () => {
    await db.delete(paymentGroupDelivery).where(inArray(paymentGroupDelivery.lotId, lotIds));
    await db.delete(deliveryQuote).where(inArray(deliveryQuote.lotId, lotIds));
  };

  beforeEach(async () => {
    await clearDelivery();
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
    await clearDelivery();
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
    const claimed = await groups.claim(claimInput([a]));
    if (claimed.kind !== "claimed") throw new Error("expected a claim");
    const result = await flags.flagsFor([a, b, held]);
    expect(result.get(a)).toEqual({
      heldForReview: false,
      inPaymentInProgress: true,
      group: {
        id: claimed.group.id,
        status: "open",
        checkoutRail: "card",
        stripeCheckoutSessionId: null,
        totalAmount: "300.00",
        amountReceived: "0.00",
        memberCount: 1,
      },
    });
    expect(result.get(b)).toEqual({
      heldForReview: false,
      inPaymentInProgress: false,
      group: null,
    });
    expect(result.get(held)).toEqual({
      heldForReview: true,
      inPaymentInProgress: false,
      group: null,
    });
  });

  it("finds the live groups that hold any of the payments, once each", async () => {
    const [a, b, c] = paymentIds as [string, string, string];
    const claimed = await groups.claim(claimInput([a, b]));
    if (claimed.kind !== "claimed") throw new Error("expected a claim");
    const live = await groups.findLiveByPaymentIds([a, b, c]);
    expect(live.map((g) => g.id)).toEqual([claimed.group.id]);
    await db.transaction(async (tx) => {
      await groups.transitionInTransaction(tx, claimed.group.id, ["open"], "cancelled");
    });
    expect(await groups.findLiveByPaymentIds([a, b, c])).toEqual([]);
    expect(await groups.findLiveByPaymentIds([])).toEqual([]);
  });

  describe("money received so far", () => {
    const at = (seconds: number) => new Date(1_793_000_000_000 + seconds * 1000);
    const record = (groupId: string, amount: string, eventAt: Date) =>
      db.transaction((tx) => groups.recordReceivedInTransaction(tx, groupId, { amount, eventAt }));
    const open = async () => {
      const [a, b] = paymentIds as [string, string];
      const claimed = await groups.claim({ ...claimInput([a, b]), totalAmount: "200.00" });
      if (claimed.kind !== "claimed") throw new Error("expected a claim");
      return claimed.group.id;
    };

    it("stores the figure with the event's time, and only ever raises it", async () => {
      const id = await open();
      expect(await record(id, "60.00", at(10))).toBe(true);
      expect(await record(id, "120.00", at(20))).toBe(true);
      expect(await record(id, "90.00", at(30))).toBe(true);
      const row = await groups.findById(id);
      expect(row?.amountReceived).toBe("120.00");
      expect(row?.receivedEventAt?.getTime()).toBe(at(30).getTime());
    });

    it("ignores an event older than the last one applied", async () => {
      const id = await open();
      await record(id, "120.00", at(20));
      expect(await record(id, "60.00", at(10))).toBe(false);
      const row = await groups.findById(id);
      expect(row?.amountReceived).toBe("120.00");
      expect(row?.receivedEventAt?.getTime()).toBe(at(20).getTime());
    });

    it("never stores more than the group's total", async () => {
      const id = await open();
      await record(id, "999.00", at(10));
      expect((await groups.findById(id))?.amountReceived).toBe("200.00");
    });

    it("stores nothing for a group that is no longer live", async () => {
      const id = await open();
      await db.transaction(async (tx) => {
        await groups.transitionInTransaction(tx, id, ["open"], "cancelled");
      });
      expect(await record(id, "60.00", at(10))).toBe(false);
      expect((await groups.findById(id))?.amountReceived).toBe("0.00");
    });

    it("lets two events at the same moment both apply, keeping the larger figure", async () => {
      const id = await open();
      await record(id, "120.00", at(10));
      expect(await record(id, "60.00", at(10))).toBe(true);
      expect((await groups.findById(id))?.amountReceived).toBe("120.00");
    });
  });

  describe("courier delivery charged with the invoices", () => {
    const quoteFor = async (
      lotId: string,
      over: Partial<typeof deliveryQuote.$inferInsert> = {},
    ): Promise<string> => {
      const [row] = await db
        .insert(deliveryQuote)
        .values({
          lotId,
          buyerLegalEntityId: orgId,
          status: "accepted",
          destination: "12 Vyner Street, London E2 9DG",
          amount: "180.00",
          decidedAt: now,
          ...over,
        })
        .returning({ id: deliveryQuote.id });
      return (row as { id: string }).id;
    };
    const withDelivery = (
      ids: readonly string[],
      quoteId: string,
      lotId: string,
      amount = "180.00",
    ) => ({
      ...claimInput(ids),
      totalAmount: "280.00",
      deliveries: [{ quoteId, lotId, amount }],
    });

    it("lists an accepted quote as chargeable until a payment takes it", async () => {
      const [a] = paymentIds as [string];
      const quote = await quoteFor(lotIds[0] as string);
      expect(await chargeable.acceptedFor(orgId, lotIds)).toEqual([
        expect.objectContaining({ quoteId: quote, lotId: lotIds[0], amount: "180.00" }),
      ]);
      const claimed = await groups.claim(withDelivery([a], quote, lotIds[0] as string));
      expect(claimed.kind).toBe("claimed");
      expect(await chargeable.acceptedFor(orgId, lotIds)).toEqual([]);
    });

    it("does not list a quote that is still being priced, withdrawn or for another account", async () => {
      await quoteFor(lotIds[0] as string, { status: "quoted" });
      await quoteFor(lotIds[1] as string, { status: "withdrawn" });
      await quoteFor(lotIds[2] as string, { buyerLegalEntityId: otherOrgId });
      expect(await chargeable.acceptedFor(orgId, lotIds)).toEqual([]);
      expect(await chargeable.acceptedFor(orgId, [])).toEqual([]);
    });

    it("stores the charge with the group and reads it back with the group locked", async () => {
      const [a] = paymentIds as [string];
      const quote = await quoteFor(lotIds[0] as string);
      const claimed = await groups.claim(withDelivery([a], quote, lotIds[0] as string));
      if (claimed.kind !== "claimed") throw new Error("expected a claim");
      const expected = [{ quoteId: quote, lotId: lotIds[0], amount: "180.00" }];
      expect(await groups.listDeliveries(claimed.group.id)).toEqual(expected);
      await db.transaction(async (tx) => {
        expect((await groups.lockInTransaction(tx, claimed.group.id))?.deliveries).toEqual(
          expected,
        );
      });
    });

    it("takes nothing when the quote was withdrawn, re-priced or is another account's", async () => {
      const [a] = paymentIds as [string];
      const withdrawn = await quoteFor(lotIds[0] as string, { status: "withdrawn" });
      expect(await groups.claim(withDelivery([a], withdrawn, lotIds[0] as string))).toEqual({
        kind: "conflict",
      });
      const priced = await quoteFor(lotIds[1] as string);
      expect(await groups.claim(withDelivery([a], priced, lotIds[1] as string, "179.99"))).toEqual({
        kind: "conflict",
      });
      const wrongLot = await quoteFor(lotIds[2] as string);
      expect(await groups.claim(withDelivery([a], wrongLot, lotIds[0] as string))).toEqual({
        kind: "conflict",
      });
      const foreign = await quoteFor(lotIds[3] as string, { buyerLegalEntityId: otherOrgId });
      expect(await groups.claim(withDelivery([a], foreign, lotIds[3] as string))).toEqual({
        kind: "conflict",
      });
      // Nothing was left behind: no group, and the invoice is still free.
      expect(await groupOf(a)).toBeNull();
      const left = await db
        .select({ id: paymentGroup.id })
        .from(paymentGroup)
        .where(eq(paymentGroup.buyerLegalEntityId, orgId));
      expect(left).toEqual([]);
    });

    it("lets one payment charge a quote even when two race for it", async () => {
      const [a, b] = paymentIds as [string, string];
      const quote = await quoteFor(lotIds[0] as string);
      const results = await Promise.all([
        groups.claim(withDelivery([a], quote, lotIds[0] as string)),
        groups.claim(withDelivery([b], quote, lotIds[0] as string)),
      ]);
      expect(results.filter((r) => r.kind === "claimed")).toHaveLength(1);
      expect(results.filter((r) => r.kind === "conflict")).toHaveLength(1);
      const charges = await db
        .select({ id: paymentGroupDelivery.id })
        .from(paymentGroupDelivery)
        .where(eq(paymentGroupDelivery.deliveryQuoteId, quote));
      expect(charges).toHaveLength(1);
    });

    it("frees the quote when the group is let go, and keeps it charged once paid", async () => {
      const [a, b] = paymentIds as [string, string];
      const quote = await quoteFor(lotIds[0] as string);
      const first = await groups.claim(withDelivery([a], quote, lotIds[0] as string));
      if (first.kind !== "claimed") throw new Error("expected a claim");
      await db.transaction(async (tx) => {
        await groups.transitionInTransaction(tx, first.group.id, ["open"], "cancelled");
        await groups.releaseMembersInTransaction(tx, first.group.id);
      });
      expect(await groups.listDeliveries(first.group.id)).toEqual([]);
      expect((await chargeable.acceptedFor(orgId, lotIds)).map((q) => q.quoteId)).toEqual([quote]);

      const second = await groups.claim(withDelivery([b], quote, lotIds[0] as string));
      if (second.kind !== "claimed") throw new Error("expected a claim");
      await db.transaction(async (tx) => {
        await groups.transitionInTransaction(tx, second.group.id, ["open"], "paid");
      });
      // A paid group keeps its charge, so the quote can never be charged a second time.
      expect(await groups.listDeliveries(second.group.id)).toHaveLength(1);
      expect(await chargeable.acceptedFor(orgId, lotIds)).toEqual([]);
      expect(await groups.claim(withDelivery([a], quote, lotIds[0] as string))).toEqual({
        kind: "conflict",
      });
    });
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
