import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import {
  bidInvoice,
  bidInvoiceLine,
  consignmentAgreement,
  domainEvent,
  itemSubmission,
  legalEntity,
  lot,
  payment,
  paymentRefund,
  payout,
  payoutLine,
  processedStripeEvents,
  saleSellerTerms,
} from "@auction/db/schema";
import {
  PayoutAdjustmentService,
  type PayoutSettlementDeps,
  REFUND_TRUE_UP_NOTE,
  createSettlement,
  payoutRepoForTx,
  settlementSellerTermsForTx,
} from "@auction/finance-runtime";
import {
  DrizzleAdminWorkItemsReader,
  DrizzlePaymentRefundRepository,
  DrizzlePaymentRepository,
  DrizzlePaymentWebhookLookupReader,
  DrizzlePayoutRepository,
  DrizzleSoldLotsReader,
  DrizzleTransactionRunner,
} from "@auction/persistence/repositories";
import { and, eq, inArray, like, sql } from "drizzle-orm";
import type Stripe from "stripe";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  deleteIdentityUserFixtures,
  seedIdentityUserFixtures,
} from "../../testing/identity-user-fixtures.js";
import { DomainEventSink } from "../domain-event-sink.js";
import { DomainEventPublisher } from "../domain-event.publisher.js";
import { executePaymentRefundLedger } from "../payment/refund-execution.js";
import { StripePaymentWebhookService } from "../stripe-payment-webhook.service.js";
import { PayoutAdjustmentService as ApiPayoutAdjustmentService } from "./payout-adjustment.service.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);
const pounds = (amount: number) => Math.round(amount * 100);

type SaleSeed = {
  hammer: number;
  premium: number;
  /** The agreement behind the lot: its commission, or `null` for none on record. */
  commissionPercent: string | null;
  /** The snapshot stored at raise; left out, the payment predates snapshots. */
  raised?: "agreement" | "held" | "none";
  laxOwned?: boolean;
};

/**
 * A payout run against a real database: each sale paid from its seller-terms snapshot, held sales
 * left out and released once the agreement is on record, payments raised before snapshots priced
 * at payout, LAX's own stock never paid, and a refund after payout charging the seller their net.
 */
describe.skipIf(!HAS_DB)("payout run on seller terms (integration)", () => {
  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);
  const repo = new DrizzlePayoutRepository(db);
  const runner = new DrizzleTransactionRunner(db);
  const events: { eventType: string; payload: Record<string, unknown> }[] = [];
  const deps: PayoutSettlementDeps = {
    repo,
    transactionRunner: runner,
    domainEventSink: {
      withTx: () => ({
        publish: async (event) => {
          events.push(event as never);
        },
      }),
    },
    payoutAdjustments: undefined,
    payoutRepoForTx: (tx) => payoutRepoForTx(repo, tx),
    sellerTermsForTx: settlementSellerTermsForTx,
  };

  const buyerId = `payout-terms-buyer-${randomUUID()}`;
  const buyerEntity = randomUUID();
  const sellerEntity = randomUUID();
  const laxEntity = randomUUID();
  const lotIds: string[] = [];
  const submissionIds: string[] = [];

  async function seedSale(seed: SaleSeed) {
    const seller = seed.laxOwned ? laxEntity : sellerEntity;
    const lotId = randomUUID();
    lotIds.push(lotId);
    await db.insert(lot).values({
      id: lotId,
      title: `Settle ${lotId.slice(0, 6)}`,
      images: [],
      auctionType: "english",
      startingPrice: "100.00",
      currentPrice: seed.hammer.toFixed(2),
      minBidIncrement: "10.00",
      startTime: new Date(Date.now() - 10 * 86_400_000),
      endTime: new Date(Date.now() - 2 * 86_400_000),
      status: "ended",
      sellerLegalEntityId: seller,
      winnerId: buyerId,
      buyerLegalEntityId: buyerEntity,
    });
    let agreementId: string | null = null;
    if (seed.commissionPercent !== null) {
      const submissionId = randomUUID();
      submissionIds.push(submissionId);
      await db.insert(itemSubmission).values({
        id: submissionId,
        legalEntityId: seller,
        title: "Consigned work",
        convertedLotId: lotId,
      });
      const [agreement] = await db
        .insert(consignmentAgreement)
        .values({
          submissionId,
          legalEntityId: seller,
          termsVersion: "v1",
          commissionPercent: seed.commissionPercent,
          acceptedAt: new Date("2026-10-01T10:00:00Z"),
        })
        .returning({ id: consignmentAgreement.id });
      agreementId = agreement?.id ?? null;
    }
    const totalPence = pounds(seed.hammer) + pounds(seed.premium);
    const [invoice] = await db
      .insert(bidInvoice)
      .values({
        lotId,
        buyerLegalEntityId: buyerEntity,
        sellerLegalEntityId: seller,
        totalPence,
        raisedAt: new Date(),
        dueAt: new Date(Date.now() + 86_400_000),
      })
      .returning({ id: bidInvoice.id });
    if (!invoice) throw new Error("invoice was not stored");
    await db.insert(bidInvoiceLine).values([
      {
        invoiceId: invoice.id,
        position: 1,
        kind: "hammer",
        label: "Hammer",
        amountPence: pounds(seed.hammer),
      },
      {
        invoiceId: invoice.id,
        position: 2,
        kind: "buyers_premium",
        label: "Buyer's premium",
        amountPence: pounds(seed.premium),
      },
    ]);
    const [paid] = await db
      .insert(payment)
      .values({
        lotId,
        buyerId,
        buyerLegalEntityId: buyerEntity,
        sellerLegalEntityId: seller,
        amount: (totalPence / 100).toFixed(2),
        // The old rule's 5% of hammer plus premium: kept for audit, never paid from.
        platformFee: (Math.round(totalPence * 0.05) / 100).toFixed(2),
        status: "captured",
        invoiceId: invoice.id,
      })
      .returning({ id: payment.id });
    if (!paid) throw new Error("payment was not stored");
    const base = {
      paymentId: paid.id,
      lotId,
      sellerLegalEntityId: seller,
      hammerPence: pounds(seed.hammer),
      premiumPence: pounds(seed.premium),
      ruleVersion: "agreement_hammer_v1",
    };
    if (seed.raised === "held") {
      await db
        .insert(saleSellerTerms)
        .values({ ...base, basis: "held", heldReason: "no_agreement" });
    } else if (seed.raised === "agreement" && agreementId) {
      await db.insert(saleSellerTerms).values({
        ...base,
        basis: "agreement",
        agreementId,
        commissionBps: 1500,
        commissionPence: pounds(seed.hammer * 0.15),
        commissionVatTreatment: "standard",
        commissionVatBps: 2000,
        commissionVatPence: pounds(seed.hammer * 0.03),
        sellerNetPence:
          pounds(seed.hammer) - pounds(seed.hammer * 0.15) - pounds(seed.hammer * 0.03),
      });
    } else if (seed.laxOwned) {
      await db.insert(saleSellerTerms).values({ ...base, basis: "lax_owned" });
    }
    return { lotId, paymentId: paid.id };
  }

  async function recordAgreement(lotId: string, commissionPercent: string) {
    const submissionId = randomUUID();
    submissionIds.push(submissionId);
    await db.insert(itemSubmission).values({
      id: submissionId,
      legalEntityId: sellerEntity,
      title: "Recorded work",
      convertedLotId: lotId,
    });
    await db.insert(consignmentAgreement).values({
      submissionId,
      legalEntityId: sellerEntity,
      termsVersion: "v1",
      commissionPercent,
      acceptedAt: new Date("2026-11-01T10:00:00Z"),
    });
  }

  const linesOf = (payoutId: string) =>
    db.select().from(payoutLine).where(eq(payoutLine.payoutId, payoutId));

  // The refund paths as they run in the API: a staff refund, and the card refund event.
  const run = randomUUID().slice(0, 8);
  const eventSink = new DomainEventSink(new DomainEventPublisher(), db);
  const refundRecords = new DrizzlePaymentRefundRepository(db);
  const payments = new DrizzlePaymentRepository(db);
  const adjustments = new ApiPayoutAdjustmentService(
    runner,
    repo,
    (_root, tx) => new DrizzlePayoutRepository(tx),
  );
  const webhooks = new StripePaymentWebhookService(
    runner,
    new DrizzlePaymentWebhookLookupReader(db),
    payments,
    repo,
    adjustments,
    {} as never,
    eventSink,
    { record: async () => undefined } as never,
    null,
    null,
    null,
    null,
    null,
    refundRecords,
  );
  let periodEnds = 10;
  const nextPeriodEnd = () => new Date(Date.now() + 10_000 * periodEnds++);

  /** Makes the sale a captured card payment, so a card refund event can name it. */
  async function cardPayment(paymentId: string) {
    const chargeId = `ch_terms_${run}_${randomUUID()}`;
    await db.update(payment).set({ stripeChargeId: chargeId }).where(eq(payment.id, paymentId));
    await db.insert(domainEvent).values({
      aggregateType: "payment",
      aggregateId: paymentId,
      eventType: "payment.captured",
      payload: {},
      producer: "integration-test",
    });
    return chargeId;
  }

  /** The card refund event Stripe sends once this much of the charge has been refunded. */
  const cardRefundEvent = (paymentId: string, chargeId: string, refundedPence: number) => {
    const charge = {
      id: chargeId,
      amount: pounds(1_250),
      amount_refunded: refundedPence,
      currency: "gbp",
      payment_intent: null,
      metadata: { paymentId },
    } as unknown as Stripe.Charge;
    const event = {
      id: `evt_terms_${run}_${randomUUID()}`,
      type: "charge.refunded",
      data: { object: charge },
    } as unknown as Stripe.Event;
    return webhooks.handleChargeRefunded(event, charge);
  };

  /** A staff part refund, as the refund paths record one: under the payment's row lock. */
  const partRefund = (paymentId: string, pence: number) =>
    runner.runInTransaction(async (tx) => {
      const key = `staff-part-${randomUUID()}`;
      await refundRecords.lockPaymentInTransaction(tx, paymentId);
      await refundRecords.recordInTransaction(tx, {
        paymentId,
        idempotencyKey: key,
        amountPence: pence,
        currency: "GBP",
        source: "staff",
      });
      await adjustments.addPaymentLineToOpenPayoutOrCreateClawback({
        legalEntityId: sellerEntity,
        paymentId,
        amount: (-pence / 100).toFixed(2),
        kind: "refund",
        sourceEventId: key,
        note: "Part refund",
        tx,
      });
    });

  /** A staff refund of the whole payment, through the API's own refund ledger. */
  async function fullRefund(paymentId: string) {
    const record = await payments.findById(paymentId);
    if (!record) throw new Error("payment not found");
    const result = await executePaymentRefundLedger(
      {
        payments,
        paymentRefunds: refundRecords,
        transactionRunner: runner,
        domainEventSink: eventSink,
        payoutAdjustments: adjustments,
        paymentRefundReconcile: null,
        xeroPaymentRecorder: null,
      },
      {
        payment: record,
        adminUserId: buyerId,
        stripeRefundId: null,
        via: "admin_manual",
        sourceEventId: `staff-full-${paymentId}`,
        clawbackNote: "Refund",
        logViaField: false,
      },
    );
    if (result.isErr()) throw result.error;
  }

  const refundLinesOf = (paymentId: string) =>
    db
      .select()
      .from(payoutLine)
      .where(and(eq(payoutLine.paymentId, paymentId), eq(payoutLine.kind, "refund")));

  /** What the seller's ledger holds for the sale's refunds: the amount and the buyer refund. */
  async function refundLedger(paymentId: string) {
    const lines = await refundLinesOf(paymentId);
    return {
      chargedPence: lines.reduce((n, l) => n - Math.round(Number(l.amount) * 100), 0),
      // A line from before this release answered for its own amount.
      answeredPence: lines.reduce(
        (n, l) => n + (l.buyerRefundPence ?? Math.abs(Math.round(Number(l.amount) * 100))),
        0,
      ),
    };
  }

  async function announcements(paymentId: string) {
    const rows = await db
      .select({ id: domainEvent.id })
      .from(domainEvent)
      .where(
        and(eq(domainEvent.aggregateId, paymentId), eq(domainEvent.eventType, "payment.refunded")),
      );
    return rows.length;
  }

  /**
   * A payout run with a refund of `paymentId` started in the window between the run reading what
   * was refunded and storing the sale line. The run carries on once the refund has committed or
   * is waiting on a lock; `blocked` says which.
   */
  function runWithRefundInWindow(paymentId: string, refund: () => Promise<unknown>) {
    const state: { refund: Promise<unknown> | null; blocked: boolean } = {
      refund: null,
      blocked: false,
    };
    const gated: PayoutSettlementDeps = {
      ...deps,
      sellerTermsForTx: (tx) => {
        const inner = settlementSellerTermsForTx(tx);
        return {
          forPreview: (pending, seller) => inner.forPreview(pending, seller),
          forRun: async (pending, seller) => {
            if (pending.id === paymentId && !state.refund) {
              let settled = false;
              state.refund = refund().finally(() => {
                settled = true;
              });
              state.refund.catch(() => undefined);
              for (let i = 0; i < 200 && !settled; i++) {
                const waiting = await db.execute<{ n: number }>(sql`
                  SELECT count(*)::int AS n FROM pg_stat_activity
                  WHERE datname = current_database() AND wait_event_type = 'Lock'
                `);
                if (Number(waiting.rows[0]?.n ?? 0) > 0) {
                  state.blocked = true;
                  break;
                }
                await new Promise((resolve) => setTimeout(resolve, 25));
              }
            }
            return inner.forRun(pending, seller);
          },
        };
      },
    };
    return { gated, state };
  }

  beforeAll(async () => {
    await seedIdentityUserFixtures(db, [
      { id: buyerId, name: buyerId, email: `${buyerId}@integration.test` },
    ]);
    for (const [id, kind, subkind] of [
      [buyerEntity, "individual", "private_collector"],
      [sellerEntity, "organisation", "gallery"],
      [laxEntity, "organisation", "lax_stock"],
    ] as const) {
      await db.insert(legalEntity).values({
        id,
        displayName: `Entity ${id.slice(0, 4)}`,
        kind,
        subkind,
        createdByUserId: buyerId,
        status: "approved",
      });
    }
  });

  afterAll(async () => {
    const payouts = await db
      .select({ id: payout.id })
      .from(payout)
      .where(inArray(payout.legalEntityId, [sellerEntity, laxEntity]));
    if (payouts.length) {
      const ids = payouts.map((p) => p.id);
      await db.delete(payoutLine).where(inArray(payoutLine.payoutId, ids));
      await db.delete(payout).where(inArray(payout.id, ids));
    }
    await db.delete(saleSellerTerms).where(inArray(saleSellerTerms.lotId, lotIds));
    const paymentIds = (
      await db.select({ id: payment.id }).from(payment).where(inArray(payment.lotId, lotIds))
    ).map((p) => p.id);
    if (paymentIds.length) {
      await db.delete(paymentRefund).where(inArray(paymentRefund.paymentId, paymentIds));
      await db.delete(domainEvent).where(inArray(domainEvent.aggregateId, paymentIds));
    }
    await db
      .delete(processedStripeEvents)
      .where(like(processedStripeEvents.eventId, `evt_terms_${run}_%`));
    await db.delete(payment).where(inArray(payment.lotId, lotIds));
    await db.delete(bidInvoice).where(inArray(bidInvoice.lotId, lotIds));
    if (submissionIds.length) {
      await db
        .delete(consignmentAgreement)
        .where(inArray(consignmentAgreement.submissionId, submissionIds));
      await db.delete(itemSubmission).where(inArray(itemSubmission.id, submissionIds));
    }
    await db.delete(lot).where(inArray(lot.id, lotIds));
    await db
      .delete(legalEntity)
      .where(inArray(legalEntity.id, [buyerEntity, sellerEntity, laxEntity]));
    await deleteIdentityUserFixtures(db, [buyerId]);
  });

  it("pays ready sales from their snapshots, holds the one without an agreement, prices an old payment, and pays LAX nothing", async () => {
    const owner = await seedSale({
      hammer: 82_000,
      premium: 20_500,
      commissionPercent: "15.00",
      raised: "agreement",
    });
    const old = await seedSale({
      hammer: 10_000,
      premium: 2_500,
      commissionPercent: "3.00",
      raised: "none",
    });
    const held = await seedSale({
      hammer: 6_200,
      premium: 1_550,
      commissionPercent: null,
      raised: "held",
    });
    const laxOwned = await seedSale({
      hammer: 4_800,
      premium: 1_200,
      commissionPercent: null,
      laxOwned: true,
    });

    const result = await createSettlement(deps, "staff-1", {
      legalEntityId: sellerEntity,
      periodEnd: new Date(),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.heldSales).toEqual([
      { paymentId: held.paymentId, lotId: held.lotId, reason: "no_agreement" },
    ]);
    // £82,000 at 15% + VAT pays £67,240.00; £10,000 at 3% + VAT pays £9,640.00.
    expect(result.payout).toMatchObject({
      grossAmount: "92000.00",
      platformFee: "15120.00",
      netAmount: "76880.00",
      sellerTermsTotals: { hammer: "92000.00", commission: "12600.00", commissionVat: "2520.00" },
    });
    const lines = await linesOf(result.payout.id);
    expect(lines.map((l) => l.paymentId).sort()).toEqual([owner.paymentId, old.paymentId].sort());
    expect(lines.every((l) => l.sellerTermsId !== null)).toBe(true);

    // The old payment was priced at payout, with the old fee kept beside the new figures.
    const [priced] = await db
      .select()
      .from(saleSellerTerms)
      .where(eq(saleSellerTerms.paymentId, old.paymentId));
    expect(priced).toMatchObject({
      basis: "agreement",
      source: "recomputed_at_payout",
      sellerNetPence: pounds(9_640),
      legacyPlatformFeePence: pounds(625),
    });

    // LAX's own stock is not waiting for a payout at all.
    expect(await repo.listLegalEntityIdsWithUnlinkedCapturedPayments()).not.toContain(laxEntity);
    expect(await repo.findUnlinkedCapturedPayments(laxEntity)).toEqual([]);
    expect(laxOwned.paymentId).toBeTruthy();

    // The event carries each sale's split, so the accounts never work it out again.
    const event = events.find((e) => e.eventType === "payout.settlement_created");
    expect(event?.payload).toMatchObject({
      hammerAmount: "92000.00",
      commissionAmount: "12600.00",
    });
    expect((event?.payload.sales as unknown[]).length).toBe(2);

    // Running again pays nothing twice: only the held sale is still waiting.
    const again = await createSettlement(deps, null, {
      legalEntityId: sellerEntity,
      periodEnd: new Date(),
    });
    expect(again).toMatchObject({ ok: false, reason: "no_pending_payments" });

    // The held sale is an Inbox task for the sales team, naming its fix; its figure is not shown.
    const workItems = new DrizzleAdminWorkItemsReader(db);
    const heldItem = (await workItems.listHeldSellerPayouts(200)).find(
      (item) => item.href === `/admin/lots/${held.lotId}`,
    );
    expect(heldItem).toMatchObject({
      kind: "seller_payout_held",
      subtitle: "No signed agreement on record. Record the signed agreement to release it",
    });
    const soldBefore = await new DrizzleSoldLotsReader(db).list({
      legalEntityId: sellerEntity,
      limit: 50,
      offset: 0,
    });
    expect(soldBefore.find((s) => s.lotId === held.lotId)?.payment?.sellerSide).toBeNull();

    // Recording the agreement releases the held sale into the next run.
    await recordAgreement(held.lotId, "15.00");
    const released = await createSettlement(deps, null, {
      legalEntityId: sellerEntity,
      periodEnd: new Date(Date.now() + 1000),
    });
    expect(released.ok).toBe(true);
    if (!released.ok) return;
    // £6,200 at 15% + VAT: £930.00 and £186.00 taken, £5,084.00 paid.
    expect(released.payout).toMatchObject({ grossAmount: "6200.00", netAmount: "5084.00" });
    const [repriced] = await db
      .select()
      .from(saleSellerTerms)
      .where(eq(saleSellerTerms.paymentId, held.paymentId));
    expect(repriced).toMatchObject({ basis: "agreement", source: "recomputed_at_payout" });
    // Its Inbox task clears itself once the sale is paid.
    expect(
      (await workItems.listHeldSellerPayouts(200)).some((i) => i.sourceId === heldItem?.sourceId),
    ).toBe(false);

    // The seller's sold list reads the same figures.
    const sold = await new DrizzleSoldLotsReader(db).list({
      legalEntityId: sellerEntity,
      limit: 50,
      offset: 0,
    });
    expect(sold.find((s) => s.lotId === owner.lotId)?.payment?.sellerSide).toEqual({
      amount: "82000.00",
      platformFee: "14760.00",
    });
  });

  it("a full refund after payout charges the seller the net they received, not the buyer's total", async () => {
    const sale = await seedSale({
      hammer: 1_000,
      premium: 250,
      commissionPercent: "15.00",
      raised: "agreement",
    });
    const settled = await createSettlement(deps, null, {
      legalEntityId: sellerEntity,
      periodEnd: new Date(Date.now() + 2000),
    });
    expect(settled.ok).toBe(true);
    if (!settled.ok) return;
    await db.update(payout).set({ status: "paid" }).where(eq(payout.id, settled.payout.id));

    await runner.runInTransaction(async (tx) => {
      await new PayoutAdjustmentService(runner, repo).addPaymentLineToOpenPayoutOrCreateClawback({
        legalEntityId: sellerEntity,
        paymentId: sale.paymentId,
        amount: "-1250.00",
        kind: "refund",
        sourceEventId: `evt-${sale.paymentId}`,
        note: "Refund",
        tx,
      });
    });
    const [refund] = await db
      .select()
      .from(payoutLine)
      .where(and(eq(payoutLine.paymentId, sale.paymentId), eq(payoutLine.kind, "refund")));
    // £1,000 at 15% + VAT paid the seller £820.00; that is what comes back.
    expect(refund).toMatchObject({ amount: "-820.00", buyerRefundPence: pounds(1_250) });
    expect(await repo.sumRefundLineCentsForPayment(sale.paymentId)).toBe(pounds(1_250));
  });

  it("a refund before payout charges the seller nothing, and the seller's side counts it as dealt with", async () => {
    const sale = await seedSale({
      hammer: 2_000,
      premium: 500,
      commissionPercent: "15.00",
      raised: "agreement",
    });
    await runner.runInTransaction(async (tx) => {
      // The buyer's refund is recorded first, as every refund path does.
      await tx.insert(paymentRefund).values({
        paymentId: sale.paymentId,
        idempotencyKey: `staff-${sale.paymentId}`,
        amountPence: pounds(2_500),
        currency: "GBP",
        source: "staff",
      });
      await new PayoutAdjustmentService(runner, repo).addPaymentLineToOpenPayoutOrCreateClawback({
        legalEntityId: sellerEntity,
        paymentId: sale.paymentId,
        amount: "-2500.00",
        kind: "refund",
        sourceEventId: `staff-${sale.paymentId}`,
        note: "Refund",
        tx,
      });
    });
    const lines = await db
      .select()
      .from(payoutLine)
      .where(eq(payoutLine.paymentId, sale.paymentId));
    expect(lines).toEqual([]);
    // A card refund event for the same refund then finds nothing new for the seller, so the refund
    // is not announced twice.
    expect(await repo.sumRefundLineCentsForPayment(sale.paymentId)).toBe(pounds(2_500));
  });

  it("a part refund that lands while the run is paying the sale is charged to the seller, and a later card event does not announce it again", async () => {
    const sale = await seedSale({
      hammer: 1_000,
      premium: 250,
      commissionPercent: "15.00",
      raised: "agreement",
    });
    const chargeId = await cardPayment(sale.paymentId);
    const { gated, state } = runWithRefundInWindow(sale.paymentId, () =>
      partRefund(sale.paymentId, pounds(500)),
    );
    const settled = await createSettlement(gated, null, {
      legalEntityId: sellerEntity,
      periodEnd: nextPeriodEnd(),
    });
    await state.refund;
    expect(settled.ok).toBe(true);
    if (!settled.ok) return;
    const saleLine = (await linesOf(settled.payout.id)).find(
      (l) => l.paymentId === sale.paymentId && l.kind === "sale",
    );
    expect(saleLine?.amount).toBe("1000.00");
    // £820.00 net; £500 of £1,250 refunded takes back £328.00, so the seller keeps £492.00.
    expect(await refundLedger(sale.paymentId)).toEqual({
      chargedPence: pounds(328),
      answeredPence: pounds(500),
    });
    expect(await repo.sumRefundLineCentsForPayment(sale.paymentId)).toBe(pounds(500));

    // The card event for the same refund finds nothing new: no charge, no second announcement.
    const card = await cardRefundEvent(sale.paymentId, chargeId, pounds(500));
    expect(card).toMatchObject({ action: "skipped", reason: "no_new_refund_amount" });
    expect(await announcements(sale.paymentId)).toBe(0);
    expect((await refundLedger(sale.paymentId)).chargedPence).toBe(pounds(328));
    // The run held the sale's payment row, so the refund waited for the sale line.
    expect(state.blocked).toBe(true);
  });

  it("a full refund that lands while the run is paying the sale takes back the whole net, announced once", async () => {
    const sale = await seedSale({
      hammer: 1_000,
      premium: 250,
      commissionPercent: "15.00",
      raised: "agreement",
    });
    const chargeId = await cardPayment(sale.paymentId);
    const { gated, state } = runWithRefundInWindow(sale.paymentId, () =>
      fullRefund(sale.paymentId),
    );
    const settled = await createSettlement(gated, null, {
      legalEntityId: sellerEntity,
      periodEnd: nextPeriodEnd(),
    });
    await state.refund;
    expect(settled.ok).toBe(true);
    // Paid £820.00 and charged £820.00: the seller keeps nothing of a sale refunded in full.
    expect(await refundLedger(sale.paymentId)).toEqual({
      chargedPence: pounds(820),
      answeredPence: pounds(1_250),
    });
    expect(await announcements(sale.paymentId)).toBe(1);

    const card = await cardRefundEvent(sale.paymentId, chargeId, pounds(1_250));
    expect(card).toMatchObject({ action: "skipped", reason: "no_new_refund_amount" });
    expect(await announcements(sale.paymentId)).toBe(1);
    expect((await refundLedger(sale.paymentId)).chargedPence).toBe(pounds(820));
    expect(state.blocked).toBe(true);
  });

  it("a sale captured after the run locked the payments it pays is left to the next run", async () => {
    const held = await seedSale({
      hammer: 1_000,
      premium: 250,
      commissionPercent: "15.00",
      raised: "agreement",
    });
    const late = await seedSale({
      hammer: 2_000,
      premium: 500,
      commissionPercent: "15.00",
      raised: "agreement",
    });
    await db.update(payment).set({ status: "authorized" }).where(eq(payment.id, late.paymentId));
    // The capture commits on its own connection just after the run has locked its payments, so
    // the run never holds the late sale's row.
    const captureAfterLock: PayoutSettlementDeps = {
      ...deps,
      payoutRepoForTx: (tx) => {
        const r = payoutRepoForTx(repo, tx);
        const lock = r.lockPendingPayments.bind(r);
        r.lockPendingPayments = async (legalEntityId) => {
          const locked = await lock(legalEntityId);
          await db
            .update(payment)
            .set({ status: "captured" })
            .where(eq(payment.id, late.paymentId));
          return locked;
        };
        return r;
      },
    };
    const first = await createSettlement(captureAfterLock, null, {
      legalEntityId: sellerEntity,
      periodEnd: nextPeriodEnd(),
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect((await linesOf(first.payout.id)).map((l) => l.paymentId)).toEqual([held.paymentId]);

    const next = await createSettlement(deps, null, {
      legalEntityId: sellerEntity,
      periodEnd: nextPeriodEnd(),
    });
    expect(next.ok).toBe(true);
    if (!next.ok) return;
    expect(await linesOf(next.payout.id)).toEqual([
      expect.objectContaining({ paymentId: late.paymentId, kind: "sale", amount: "2000.00" }),
    ]);
  });

  it("a refund whose share rounds to nothing is recorded at £0.00, so a card event does not announce it again", async () => {
    const sale = await seedSale({
      hammer: 1_000,
      premium: 250,
      commissionPercent: "15.00",
      raised: "agreement",
    });
    const chargeId = await cardPayment(sale.paymentId);
    const settled = await createSettlement(deps, null, {
      legalEntityId: sellerEntity,
      periodEnd: nextPeriodEnd(),
    });
    expect(settled.ok).toBe(true);
    if (!settled.ok) return;
    await db.update(payout).set({ status: "paid" }).where(eq(payout.id, settled.payout.id));

    // 1p of £1,250 takes back 1p of the £820.00 net (0.656p, half-up).
    await partRefund(sale.paymentId, 1);
    expect(await refundLedger(sale.paymentId)).toEqual({ chargedPence: 1, answeredPence: 1 });
    await db
      .update(payout)
      .set({ status: "paid" })
      .where(and(eq(payout.legalEntityId, sellerEntity), eq(payout.status, "scheduled")));

    // A second 1p: 2p of £1,250 is 1.312p of the net, so nothing more is due.
    await partRefund(sale.paymentId, 1);
    const zero = (await refundLinesOf(sale.paymentId)).find((l) => l.amount === "0.00");
    expect(zero).toMatchObject({ buyerRefundPence: 1 });
    expect(await refundLedger(sale.paymentId)).toEqual({ chargedPence: 1, answeredPence: 2 });
    expect(await repo.sumRefundLineCentsForPayment(sale.paymentId)).toBe(2);

    const card = await cardRefundEvent(sale.paymentId, chargeId, 2);
    expect(card).toMatchObject({ action: "skipped", reason: "no_new_refund_amount" });
    expect(await announcements(sale.paymentId)).toBe(0);

    // A third 1p is measured from all three: 3p of £1,250 is 1.968p, so 1p more.
    await partRefund(sale.paymentId, 1);
    expect(await refundLedger(sale.paymentId)).toEqual({ chargedPence: 2, answeredPence: 3 });
  });

  it("a part refund charged in full by the previous release before payout is brought back to the seller's share as the sale is paid", async () => {
    const sale = await seedSale({
      hammer: 1_000,
      premium: 250,
      commissionPercent: "15.00",
      raised: "agreement",
    });
    // As the previous release left it: the buyer's £500 refund on record (0344's backfill), and
    // the whole £500 charged on a clawback payout already settled, with no buyer refund stored.
    await db.insert(paymentRefund).values({
      paymentId: sale.paymentId,
      idempotencyKey: `old-release-${sale.paymentId}`,
      amountPence: pounds(500),
      currency: "GBP",
      source: "staff",
    });
    const [clawback] = await db
      .insert(payout)
      .values({
        legalEntityId: sellerEntity,
        periodStart: new Date("2026-10-01T00:00:00Z"),
        periodEnd: new Date("2026-10-01T00:00:01Z"),
        grossAmount: "-500.00",
        platformFee: "0.00",
        stripeFee: "0.00",
        netAmount: "-500.00",
        currency: "GBP",
        status: "paid",
      })
      .returning({ id: payout.id });
    if (!clawback) throw new Error("payout was not stored");
    await db.insert(payoutLine).values({
      payoutId: clawback.id,
      paymentId: sale.paymentId,
      amount: "-500.00",
      kind: "refund",
      note: "Refund",
    });

    const settled = await createSettlement(deps, null, {
      legalEntityId: sellerEntity,
      periodEnd: nextPeriodEnd(),
    });
    expect(settled.ok).toBe(true);
    if (!settled.ok) return;
    // The share of £500 is £328.00, so £172.00 of the old charge comes back with the sale.
    const trueUp = (await linesOf(settled.payout.id)).find(
      (l) => l.paymentId === sale.paymentId && l.kind === "refund",
    );
    expect(trueUp).toMatchObject({
      amount: "172.00",
      buyerRefundPence: 0,
      note: REFUND_TRUE_UP_NOTE,
    });
    expect(await refundLedger(sale.paymentId)).toEqual({
      chargedPence: pounds(328),
      answeredPence: pounds(500),
    });
    // The credit is not read as a refund to the buyer.
    const topUp = await db.execute<{ added: number }>(
      sql`SELECT payment_refund_backfill_from_payout_lines(${sale.paymentId}::uuid) AS added`,
    );
    expect(Number(topUp.rows[0]?.added)).toBe(0);
    expect(await repo.sumRefundLineCentsForPayment(sale.paymentId)).toBe(pounds(500));

    // A further £250 after payout is measured from the share: £750 of £1,250 is £492.00.
    await partRefund(sale.paymentId, pounds(250));
    expect(await refundLedger(sale.paymentId)).toEqual({
      chargedPence: pounds(492),
      answeredPence: pounds(750),
    });
  });
});
