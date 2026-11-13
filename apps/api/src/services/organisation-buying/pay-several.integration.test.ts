import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { bidInvoice, legalEntity, lot, payment, paymentGroup } from "@auction/db/schema";
import { InvoiceRaiser, LotInvoiceInitiationService } from "@auction/finance-runtime";
import {
  DrizzleAccountPurchaseFactsReader,
  DrizzleBidInvoiceRepository,
  DrizzleLegalEntityMembershipReader,
  DrizzleLegalEntityReader,
  DrizzleLegalEntityRepository,
  DrizzleLotRepository,
  DrizzlePaySeveralInvoiceFlagsReader,
  DrizzlePaymentGroupRepository,
  DrizzlePaymentRepository,
} from "@auction/persistence/repositories";
import { eq, inArray } from "drizzle-orm";
import { err, ok } from "neverthrow";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  deleteIdentityUserFixtures,
  seedIdentityUserFixtures,
} from "../../testing/identity-user-fixtures.js";
import { sellerTermsForTests } from "../../testing/seller-terms.js";
import type { OrganisationMemberActor } from "../interfaces/organisation-membership-service.js";
import { NotificationFactory } from "../notification.factory.js";
import { PaymentTierPolicy, parsePaymentTierLimits } from "../payment/payment-tier.policy.js";
import { PayPlanService } from "./pay-plan.service.js";
import { PayProgressResolver } from "./pay-progress.resolver.js";
import { PaySeveralService } from "./pay-several.service.js";
import { PurchaseCandidateReader } from "./purchase-candidate.reader.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

const LIMITS = {
  minPence: 30,
  cardMaxPence: 1_000_000,
  manualReviewMinPence: 50_000_000,
  absoluteMaxPence: 99_999_999,
};

/**
 * Paying several lots when some are not invoiced yet, against the real tables: the plan, the
 * invoices raised for it and the group that claims them agree to the penny.
 */

/** Pays the plan the person was shown for these lots, as the screen does. */
async function payShown(
  svc: Pick<PaySeveralService, "plan" | "pay">,
  who: OrganisationMemberActor,
  lots: readonly string[],
  expected?: { expectedTotalPence: number; expectedLotIds: readonly string[] },
) {
  const shown = await svc.plan(who, lots);
  const fromPlan = shown.isOk()
    ? {
        expectedTotalPence: Math.round(Number(shown.value.total) * 100),
        expectedLotIds: shown.value.payable.map((p) => p.lotId),
      }
    : { expectedTotalPence: 1, expectedLotIds: [lots[0] as string] };
  return svc.pay(who, { lotIds: lots, ...(expected ?? fromPlan) });
}

describe.skipIf(!HAS_DB)("pay several raises what the plan counts (integration)", () => {
  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);
  const invoices = new DrizzleBidInvoiceRepository(db);
  const payments = new DrizzlePaymentRepository(db);
  const lots = new DrizzleLotRepository(db);
  const groups = new DrizzlePaymentGroupRepository(db);
  const raiser = new InvoiceRaiser({ invoices, sales: null });

  const day = 86_400_000;
  const buyerId = `psev-buyer-${randomUUID()}`;
  const buyerEntity = randomUUID();
  const sellerEntity = randomUUID();
  const lotIds: string[] = [];

  async function wonLot(currentPrice: string): Promise<string> {
    const id = randomUUID();
    lotIds.push(id);
    await db.insert(lot).values({
      id,
      title: `Several ${id.slice(0, 6)}`,
      lotNumber: lotIds.length,
      images: [],
      auctionType: "english",
      startingPrice: "100.00",
      currentPrice,
      // The lot's own 25% premium: the figures below are worked at it.
      buyerPremiumRate: "0.25",
      minBidIncrement: "10.00",
      startTime: new Date(Date.now() - 10 * day),
      endTime: new Date(Date.now() - 2 * day),
      status: "ended",
      sellerLegalEntityId: sellerEntity,
      winnerId: buyerId,
      buyerLegalEntityId: buyerEntity,
    });
    return id;
  }

  /** The lot-end raise, with the reviewing check either holding the buyer or not. */
  function lotEnd(hold: boolean, failRaise = false) {
    return new LotInvoiceInitiationService(
      lots,
      failRaise
        ? ({
            price: async () => {
              throw new Error("the invoice store is down");
            },
          } as unknown as InvoiceRaiser)
        : raiser,
      payments,
      {
        evaluate: async () =>
          hold ? { hold: true, reason: "aml_hold" } : { hold: false, reason: null },
        peek: async () => ({ hold: false, reason: null }),
      } as never,
      new PaymentTierPolicy(
        parsePaymentTierLimits({
          STRIPE_CARD_CHECKOUT_MAX: 10_000,
          STRIPE_MANUAL_REVIEW_MIN: 500_000,
          STRIPE_ABSOLUTE_MAX: 999_999.99,
        }),
      ),
      sellerTermsForTests(),
      { isConfigured: () => false, ensureInvoiceForPayment: vi.fn() } as never,
      { stageDispatch: async () => undefined } as never,
      new NotificationFactory(),
      {
        publish: async () => undefined,
        withTx: () => ({ publish: async () => undefined }),
      } as never,
      { ensureAwaitingPayment: async () => undefined, onPaymentCaptured: async () => undefined },
      null,
      { findById: async () => null } as never,
      { forInvoice: async ({ winnerUserId }) => [winnerUserId] },
    );
  }

  const planner = new PayPlanService({
    delivery: null,
    // Every live group counts as a payment the payer finished.
    progress: new PayProgressResolver({ checkoutStatus: async () => "complete" }),
    candidates: new PurchaseCandidateReader({
      reader: new DrizzleAccountPurchaseFactsReader(db),
      flags: new DrizzlePaySeveralInvoiceFlagsReader(db),
      now: () => new Date(),
    }),
    invoices,
    pricing: raiser,
    lots,
    accounts: new DrizzleLegalEntityRepository(
      new DrizzleLegalEntityReader(db),
      new DrizzleLegalEntityMembershipReader(db),
    ),
    onboarding: { isComplete: async () => true },
    eligibility: { check: async () => ({ kind: "payable" as const }) },
    compliance: null,
    limits: LIMITS,
    issuer: {
      name: "London Auction Xchange LTD",
      address: "156 New Cavendish Street",
      companyNumber: null,
      vatNumber: null,
    },
    now: () => new Date(),
  });

  /** The real group claim: it takes only pending payments, all or none. */
  const checkout = {
    start: async (input: {
      payerUserId: string;
      buyerLegalEntityId: string;
      currency: string;
      total: string;
      rail: "card" | "gb_bank_transfer";
      invoices: readonly { paymentId: string }[];
    }) => {
      const claim = await groups.claim({
        buyerLegalEntityId: input.buyerLegalEntityId,
        createdByUserId: input.payerUserId,
        currency: input.currency,
        totalAmount: input.total,
        checkoutRail: input.rail,
        paymentIds: input.invoices.map((i) => i.paymentId),
        deliveries: [],
      });
      return claim.kind === "claimed"
        ? ok({
            paymentGroupId: claim.group.id,
            checkoutUrl: "https://pay.example/g",
            rail: input.rail,
          })
        : err("conflict" as const);
    },
  };

  function paySeveral(initiation: Pick<LotInvoiceInitiationService, "ensureForLot">) {
    return new PaySeveralService({
      planner,
      invoices: initiation,
      limits: LIMITS,
      compliance: null,
      checkout,
    });
  }

  const actor = { userId: buyerId, legalEntityId: buyerEntity, role: "owner" as const };

  beforeAll(async () => {
    await seedIdentityUserFixtures(db, [
      { id: buyerId, name: buyerId, email: `${buyerId}@integration.test` },
    ]);
    for (const [id, kind, subkind] of [
      [buyerEntity, "individual", "private_collector"],
      [sellerEntity, "organisation", "gallery"],
    ] as const) {
      await db.insert(legalEntity).values({
        id,
        displayName: `Several entity ${id.slice(0, 4)}`,
        kind,
        subkind,
        createdByUserId: buyerId,
        status: "approved",
      });
    }
  });

  afterAll(async () => {
    await db.update(payment).set({ paymentGroupId: null }).where(inArray(payment.lotId, lotIds));
    await db.delete(paymentGroup).where(eq(paymentGroup.buyerLegalEntityId, buyerEntity));
    await db.delete(payment).where(inArray(payment.lotId, lotIds));
    await db.delete(bidInvoice).where(inArray(bidInvoice.lotId, lotIds));
    await db.delete(lot).where(inArray(lot.id, lotIds));
    await db.delete(legalEntity).where(inArray(legalEntity.id, [buyerEntity, sellerEntity]));
    await deleteIdentityUserFixtures(db, [buyerId]);
  });

  const rowsFor = (lotId: string) => db.select().from(payment).where(eq(payment.lotId, lotId));
  const invoicesFor = (lotId: string) =>
    db.select().from(bidInvoice).where(eq(bidInvoice.lotId, lotId));

  it("charges, to the penny, the total the plan showed, raising the missing invoice first", async () => {
    const raisedAlready = await wonLot("1000.00");
    await lotEnd(false).ensureForLot(raisedAlready);
    const missing = await wonLot("2000.00");
    const pick = [raisedAlready, missing];

    const shown = (await planner.plan(actor, pick))._unsafeUnwrap();
    expect(shown.totals.pence).toBe(125_000 + 250_000);
    expect(await invoicesFor(missing)).toHaveLength(0);

    const started = (await payShown(paySeveral(lotEnd(false)), actor, pick))._unsafeUnwrap();

    expect(started.total).toBe("3750.00");
    const [group] = await db
      .select()
      .from(paymentGroup)
      .where(eq(paymentGroup.id, started.paymentGroupId));
    expect(group?.totalAmount).toBe("3750.00");
    const claimed = await db
      .select()
      .from(payment)
      .where(eq(payment.paymentGroupId, started.paymentGroupId));
    expect(claimed).toHaveLength(2);
    // Each claimed payment is its invoice's total, and together they are the plan's total.
    const invoiceTotals = await Promise.all(
      claimed.map(async (p) => {
        const [inv] = await db
          .select()
          .from(bidInvoice)
          .where(eq(bidInvoice.id, p.invoiceId ?? ""));
        return [Math.round(Number(p.amount) * 100), inv?.totalPence] as const;
      }),
    );
    for (const [fromPayment, fromInvoice] of invoiceTotals) {
      expect(fromPayment).toBe(Number(fromInvoice));
    }
    expect(invoiceTotals.reduce((sum, [pence]) => sum + pence, 0)).toBe(shown.totals.pence);
  });

  it("never charges a lot whose raised invoice is held for review", async () => {
    const held = await wonLot("1500.00");
    const ok1 = await wonLot("500.00");
    await lotEnd(false).ensureForLot(ok1);

    // The lot is raised into review, so the plan shown (which counted it) is no longer the plan:
    // nothing is claimed and the fresh plan comes back.
    const svc = paySeveral(lotEnd(true));
    const refused = (await payShown(svc, actor, [ok1, held]))._unsafeUnwrapErr();
    expect(refused).toMatchObject({ code: "pay_plan_changed", status: 409 });
    expect(refused.quote?.skipped).toEqual([{ lotId: held, reason: "held_for_review" }]);
    const [heldRow] = await rowsFor(held);
    expect(heldRow?.status).toBe("requires_manual_review");
    expect(heldRow?.paymentGroupId).toBeNull();
    expect((await rowsFor(ok1))[0]?.paymentGroupId).toBeNull();

    // Paying the plan it was shown next charges only the lot that can be paid.
    const started = (await payShown(svc, actor, [ok1, held]))._unsafeUnwrap();
    expect(started.payable.map((p) => p.lotId)).toEqual([ok1]);
    expect(started.skipped).toEqual([{ lotId: held, reason: "held_for_review" }]);
    expect(started.total).toBe("625.00");
  });

  it("claims nothing when raising fails", async () => {
    const before = await db
      .select()
      .from(paymentGroup)
      .where(eq(paymentGroup.buyerLegalEntityId, buyerEntity));
    const missing = await wonLot("700.00");
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const refused = (
      await payShown(paySeveral(lotEnd(false, true)), actor, [missing])
    )._unsafeUnwrapErr();
    logged.mockRestore();

    expect(refused.code).toBe("pay_several_unavailable");
    expect(await rowsFor(missing)).toHaveLength(0);
    const after = await db
      .select()
      .from(paymentGroup)
      .where(eq(paymentGroup.buyerLegalEntityId, buyerEntity));
    expect(after).toHaveLength(before.length);
  });

  it("two attempts at once and the lot-end raise end with one invoice and one group", async () => {
    const missing = await wonLot("800.00");
    const other = await wonLot("300.00");
    await lotEnd(false).ensureForLot(other);
    const pick = [other, missing];
    const svc = paySeveral(lotEnd(false));

    const results = await Promise.all([
      payShown(svc, actor, pick),
      payShown(svc, actor, pick),
      lotEnd(false).ensureForLot(missing),
    ]);

    const started = results.slice(0, 2).filter((r) => "isOk" in r && r.isOk());
    expect(started).toHaveLength(1);
    expect(await invoicesFor(missing)).toHaveLength(1);
    expect(await rowsFor(missing)).toHaveLength(1);
    const claimed = await db.select().from(payment).where(inArray(payment.lotId, pick));
    expect(new Set(claimed.map((p) => p.paymentGroupId)).size).toBe(1);
    expect(claimed.every((p) => p.paymentGroupId !== null)).toBe(true);
  });
});
