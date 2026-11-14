import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { legalEntity, lot, payment, paymentCheckoutSession } from "@auction/db/schema";
import { DrizzlePaymentCheckoutSessionRepository } from "@auction/persistence/repositories";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeCheckoutStripe } from "../../test/fake-checkout-stripe.js";
import {
  deleteIdentityUserFixtures,
  seedIdentityUserFixtures,
} from "../../testing/identity-user-fixtures.js";
import {
  type CheckoutMoneyParameters,
  CheckoutSessionLifecycle,
} from "./stripe-checkout-session-lifecycle.js";
import type { IStripePaymentGateway } from "./stripe-payment-gateway.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

/**
 * The checkout lifecycle against the real session ledger (Stripe faked): which sessions it keeps,
 * closes and records as closed.
 */
describe.skipIf(!HAS_DB)("checkout session lifecycle (integration)", () => {
  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);
  const ledger = new DrizzlePaymentCheckoutSessionRepository(db);
  const run = randomUUID().slice(0, 8);
  const buyerId = `cs-buyer-${run}`;
  const buyerEntityId = randomUUID();
  const sellerId = randomUUID();
  const lotId = randomUUID();
  let paymentId: string;
  let stripe: FakeCheckoutStripe;
  let lifecycle: CheckoutSessionLifecycle;

  const pay = (
    rail: "card" | "bank",
    amounts: number[],
    display: { title: string; imageUrl: string },
  ) => {
    const money: CheckoutMoneyParameters & { lineItems: object[] } = {
      paymentId,
      amountCents: amounts.reduce((a, b) => a + b, 0),
      currency: "gbp",
      lineItems: amounts.map((unitAmountCents) => ({
        name: display.title,
        images: [display.imageUrl],
        unitAmountCents,
      })),
    };
    const parameters = rail === "bank" ? { ...money, stripeCustomerId: "cus_fixture" } : money;
    return lifecycle.openOrRenew(rail, paymentId, parameters, (idempotencyKey) =>
      rail === "card"
        ? stripe.createCardCheckoutSession({ ...parameters, idempotencyKey } as never)
        : stripe.createBankTransferCheckoutSession({ ...parameters, idempotencyKey } as never),
    );
  };
  const idOf = (outcome: Awaited<ReturnType<typeof pay>>) =>
    outcome.kind === "ready" ? outcome.session.sessionId : outcome.kind;
  const closedAt = async (sessionId: string) =>
    (
      await db
        .select({ closedAt: paymentCheckoutSession.closedAt })
        .from(paymentCheckoutSession)
        .where(eq(paymentCheckoutSession.stripeSessionId, sessionId))
    )[0]?.closedAt ?? null;

  beforeAll(async () => {
    const now = new Date();
    await seedIdentityUserFixtures(db, [
      { id: buyerId, name: "Buyer", email: `${buyerId}@integration.test` },
    ]);
    await db.insert(legalEntity).values(
      [buyerEntityId, sellerId].map((id) => ({
        id,
        displayName: "Fixture",
        kind: "individual" as const,
        subkind: "private_collector" as const,
        createdByUserId: buyerId,
        status: "approved" as const,
      })),
    );
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
      sellerLegalEntityId: sellerId,
      winnerId: buyerId,
      buyerLegalEntityId: buyerEntityId,
    });
  });

  beforeEach(async () => {
    await db.delete(payment).where(eq(payment.lotId, lotId));
    const [row] = await db
      .insert(payment)
      .values({
        lotId,
        buyerId,
        buyerLegalEntityId: buyerEntityId,
        sellerLegalEntityId: sellerId,
        amount: "100.00",
        platformFee: "5.00",
        status: "pending",
      })
      .returning({ id: payment.id });
    paymentId = row?.id as string;
    stripe = new FakeCheckoutStripe();
    stripe.idPrefix = `cs_${run}_${randomUUID().slice(0, 8)}_`;
    lifecycle = new CheckoutSessionLifecycle(
      stripe as unknown as IStripePaymentGateway,
      ledger,
      { report: vi.fn() },
      vi.fn(),
    );
  });

  afterAll(async () => {
    await db.delete(payment).where(eq(payment.lotId, lotId));
    await db.delete(lot).where(eq(lot.id, lotId));
    await db.delete(legalEntity).where(inArray(legalEntity.id, [buyerEntityId, sellerId]));
    await deleteIdentityUserFixtures(db, [buyerId]);
  });

  const before = { title: "Work", imageUrl: "https://img.fixture/a?sig=day1" };
  const after = { title: "Work (edited)", imageUrl: "https://img.fixture/a?sig=day2" };

  it("keeps a card session whose amount is unchanged when the buyer opens bank transfer after a display change", async () => {
    const card = idOf(await pay("card", [9_000, 1_000], before));
    const bank = idOf(await pay("bank", [9_000, 1_000], after));
    expect(stripe.open("card")).toEqual([card]);
    expect(stripe.open("bank")).toEqual([bank]);
    expect(await closedAt(card)).toBeNull();
    // The display change still gets a card session of its own when card is opened again.
    const card2 = idOf(await pay("card", [9_000, 1_000], after));
    expect(card2).not.toBe(card);
  });

  it("closes, and records as closed, a card session at the old amount", async () => {
    const card = idOf(await pay("card", [9_000], before));
    await pay("bank", [9_000, 1_000], before);
    expect(stripe.sessions.get(card)?.status).toBe("expired");
    expect(await closedAt(card)).not.toBeNull();
  });

  it("leaves a card session the buyer paid during the close open in the ledger", async () => {
    const card = idOf(await pay("card", [9_000], before));
    stripe.completeOnExpire.add(card);
    await pay("bank", [9_000, 1_000], before);
    expect(stripe.sessions.get(card)?.status).toBe("complete");
    expect(await closedAt(card)).toBeNull();
    expect(await pay("card", [9_000, 1_000], before)).toEqual({ kind: "already_complete" });
  });

  it("a session recorded before the money fingerprint (parameters only) is treated as stale", async () => {
    const legacy = await stripe.createCardCheckoutSession({ idempotencyKey: "legacy" } as never);
    await ledger.record(paymentId, legacy.sessionId, {
      rail: "card",
      parametersFingerprint: "0123456789abcdef",
    });
    await pay("bank", [9_000], before);
    expect(await closedAt(legacy.sessionId)).not.toBeNull();
  });
});
