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
  stripeRefundReversal,
} from "@auction/db/schema";
import { TRANSFER_OUTCOME_UNKNOWN_PREFIX } from "@auction/domain";
import {
  ConnectTransferInitiationService,
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
import { ok } from "neverthrow";
import type Stripe from "stripe";
import StripeSdk from "stripe";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FakeChargeRefunds } from "../../test/fake-charge-refunds.js";
import {
  deleteIdentityUserFixtures,
  seedIdentityUserFixtures,
} from "../../testing/identity-user-fixtures.js";
import { DomainEventSink } from "../domain-event-sink.js";
import { DomainEventPublisher } from "../domain-event.publisher.js";
import { executePaymentRefundLedger } from "../payment/refund-execution.js";
import { StripePaymentWebhookService } from "../stripe-payment-webhook.service.js";
import { StripeRefundReconcileService } from "../stripe-webhook/stripe-refund-reconcile.service.js";
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
  // What Stripe lists as refunded on each charge; every refund here has succeeded.
  const stripeRefunds = new FakeChargeRefunds();
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
    undefined,
    null,
    stripeRefunds,
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
    stripeRefunds.show(chargeId, refundedPence);
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
      // Added up with their sign: a line from before this release answered for its own amount,
      // and a line giving back a failed refund answers for it as a negative figure.
      answeredPence: lines.reduce(
        (n, l) => n + (l.buyerRefundPence ?? -Math.round(Number(l.amount) * 100)),
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

  /** The card charge of a £1,250 sale as Stripe sends it; its refunds are read from Stripe's list. */
  const chargeOf = (paymentId: string, chargeId: string) =>
    ({
      id: chargeId,
      amount: pounds(1_250),
      amount_refunded: 0,
      currency: "gbp",
      payment_intent: null,
      metadata: { paymentId },
    }) as unknown as Stripe.Charge;

  /** A `charge.refunded` event, settling the charge against Stripe's list as it stands. */
  const chargeRefunded = (paymentId: string, chargeId: string) => {
    const charge = chargeOf(paymentId, chargeId);
    const event = {
      id: `evt_terms_${run}_${randomUUID()}`,
      type: "charge.refunded",
      data: { object: charge },
    } as unknown as Stripe.Event;
    return webhooks.handleChargeRefunded(event, charge);
  };

  /** A card refund of the sale that succeeds at Stripe and is counted by its event. */
  async function cardRefund(paymentId: string, chargeId: string, pence: number) {
    const id = `re_terms_${run}_${randomUUID()}`;
    stripeRefunds.add({ id, chargeId, amountPence: pence, status: "succeeded" });
    await chargeRefunded(paymentId, chargeId);
    return id;
  }

  /** Stripe now reports the refund failed; `charge.refunded` settles the charge again. */
  function refundFails(refundId: string, paymentId: string, chargeId: string) {
    stripeRefunds.setStatus(refundId, "failed");
    return chargeRefunded(paymentId, chargeId);
  }

  /** The seller's open payouts are paid, so the next line goes on a payout of its own. */
  const payOpenPayouts = () =>
    db
      .update(payout)
      .set({ status: "paid" })
      .where(
        and(
          eq(payout.legalEntityId, sellerEntity),
          inArray(payout.status, ["scheduled", "in_transit"]),
        ),
      );

  /** A £1,000 hammer and £250 premium card sale at 15% + VAT, paid out (£820.00 net). */
  async function paidOutCardSale() {
    const sale = await seedSale({
      hammer: 1_000,
      premium: 250,
      commissionPercent: "15.00",
      raised: "agreement",
    });
    const chargeId = await cardPayment(sale.paymentId);
    stripeRefunds.charges.set(chargeId, chargeOf(sale.paymentId, chargeId));
    await payOpenPayouts();
    const settled = await createSettlement(deps, null, {
      legalEntityId: sellerEntity,
      periodEnd: nextPeriodEnd(),
    });
    if (!settled.ok) throw new Error("the sale was not paid out");
    await payOpenPayouts();
    return { ...sale, chargeId };
  }

  /** What `payment.refund_reversed` announced for the payment. */
  async function reversals(paymentId: string) {
    const rows = await db
      .select({ payload: domainEvent.payload })
      .from(domainEvent)
      .where(
        and(
          eq(domainEvent.aggregateId, paymentId),
          eq(domainEvent.eventType, "payment.refund_reversed"),
        ),
      );
    return rows.map((r) => r.payload);
  }

  /** The lines giving back a failed refund: refund lines answering for a negative buyer refund. */
  const giveBackLinesOf = async (paymentId: string) =>
    (await refundLinesOf(paymentId)).filter((l) => (l.buyerRefundPence ?? 0) < 0);

  /** What the buyer's refund top-up (0378) would add for the payment now. */
  async function topUpAdds(paymentId: string) {
    const added = await db.execute<{ added: number }>(
      sql`SELECT payment_refund_backfill_from_payout_lines(${paymentId}::uuid) AS added`,
    );
    return Number(added.rows[0]?.added);
  }

  /** As the previous release left a £500 refund charged in full: on record and on a paid payout. */
  async function oldReleaseFullCharge(paymentId: string, refundKey: string) {
    await db.insert(paymentRefund).values({
      paymentId,
      idempotencyKey: refundKey,
      amountPence: pounds(500),
      currency: "GBP",
      source: "card_webhook",
    });
    await oldReleaseLine(paymentId, "-500.00", "Refund");
  }

  /** A refund line the previous release wrote (no buyer refund kept), on a paid payout of its own. */
  async function oldReleaseLine(paymentId: string, amount: string, note: string) {
    const [old] = await db
      .insert(payout)
      .values({
        legalEntityId: sellerEntity,
        periodStart: new Date("2026-10-03T00:00:00Z"),
        periodEnd: new Date("2026-10-03T00:00:01Z"),
        grossAmount: amount,
        platformFee: "0.00",
        stripeFee: "0.00",
        netAmount: amount,
        currency: "GBP",
        status: "paid",
      })
      .returning({ id: payout.id });
    if (!old) throw new Error("payout was not stored");
    await db.insert(payoutLine).values({
      payoutId: old.id,
      paymentId,
      amount,
      kind: "refund",
      note,
    });
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
    await db
      .delete(processedStripeEvents)
      .where(like(processedStripeEvents.eventId, `refund_reconcile:re_terms_${run}_%`));
    await db
      .delete(stripeRefundReversal)
      .where(like(stripeRefundReversal.stripeRefundId, `re_terms_${run}_%`));
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

  it("a refund the previous release left only on the ledger is recorded for the buyer and brought back to the share as the sale is paid", async () => {
    const sale = await seedSale({
      hammer: 1_000,
      premium: 250,
      commissionPercent: "15.00",
      raised: "agreement",
    });
    // The whole £500 charged by the previous release, and nothing on the buyer's refund record:
    // 0344's backfill ran before this line was written.
    const [clawback] = await db
      .insert(payout)
      .values({
        legalEntityId: sellerEntity,
        periodStart: new Date("2026-10-02T00:00:00Z"),
        periodEnd: new Date("2026-10-02T00:00:01Z"),
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
    const recorded = await db
      .select({ amountPence: paymentRefund.amountPence, source: paymentRefund.source })
      .from(paymentRefund)
      .where(eq(paymentRefund.paymentId, sale.paymentId));
    expect(recorded).toEqual([{ amountPence: pounds(500), source: "payout_topup" }]);
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
  });
  describe("a refund that fails after it was counted gives the seller back what it charged them", () => {
    it("a £500 refund charged at the £328.00 share is given back on one line, announced once", async () => {
      const sale = await paidOutCardSale();
      const refundId = await cardRefund(sale.paymentId, sale.chargeId, pounds(500));
      expect(await refundLedger(sale.paymentId)).toEqual({
        chargedPence: pounds(328),
        answeredPence: pounds(500),
      });
      await payOpenPayouts();

      expect(await refundFails(refundId, sale.paymentId, sale.chargeId)).toMatchObject({
        action: "refund_reversed",
      });
      // Another event for the charge finds nothing left to take back.
      expect(await chargeRefunded(sale.paymentId, sale.chargeId)).toMatchObject({
        action: "skipped",
      });

      expect(await giveBackLinesOf(sale.paymentId)).toEqual([
        expect.objectContaining({ amount: "328.00", buyerRefundPence: -pounds(500) }),
      ]);
      expect(await refundLedger(sale.paymentId)).toEqual({ chargedPence: 0, answeredPence: 0 });
      expect(await repo.sumRefundLineCentsForPayment(sale.paymentId)).toBe(0);
      expect((await refundRecords.sumRefundedPence(sale.paymentId)).pence).toBe(0);
      expect(await topUpAdds(sale.paymentId)).toBe(0);
      expect(await reversals(sale.paymentId)).toEqual([
        expect.objectContaining({ amountCents: pounds(500), sellerAmountCents: pounds(328) }),
      ]);

      // The same refund made again, and succeeding, charges the share once more.
      await cardRefund(sale.paymentId, sale.chargeId, pounds(500));
      expect(await refundLedger(sale.paymentId)).toEqual({
        chargedPence: pounds(328),
        answeredPence: pounds(500),
      });
    });

    it("one of two £250 refunds failing gives back £164.00, what the share of £250 less is", async () => {
      const sale = await paidOutCardSale();
      await cardRefund(sale.paymentId, sale.chargeId, pounds(250));
      await payOpenPayouts();
      const second = await cardRefund(sale.paymentId, sale.chargeId, pounds(250));
      await payOpenPayouts();
      expect(await refundLedger(sale.paymentId)).toEqual({
        chargedPence: pounds(328),
        answeredPence: pounds(500),
      });

      await refundFails(second, sale.paymentId, sale.chargeId);

      expect(await giveBackLinesOf(sale.paymentId)).toEqual([
        expect.objectContaining({ amount: "164.00", buyerRefundPence: -pounds(250) }),
      ]);
      expect(await refundLedger(sale.paymentId)).toEqual({
        chargedPence: pounds(164),
        answeredPence: pounds(250),
      });
      expect(await repo.sumRefundLineCentsForPayment(sale.paymentId)).toBe(pounds(250));
      expect(await reversals(sale.paymentId)).toEqual([
        expect.objectContaining({ amountCents: pounds(250), sellerAmountCents: pounds(164) }),
      ]);
    });

    it("a refund that fails before payout leaves the sale to be paid as if it was never refunded", async () => {
      // Refunded, and failed, while the sale waits for its payout: this release charged nothing
      // for it, so nothing is given back.
      const fresh = await seedSale({
        hammer: 1_000,
        premium: 250,
        commissionPercent: "15.00",
        raised: "agreement",
      });
      const freshCharge = await cardPayment(fresh.paymentId);
      const freshRefund = await cardRefund(fresh.paymentId, freshCharge, pounds(500));
      await refundFails(freshRefund, fresh.paymentId, freshCharge);
      expect(await refundLinesOf(fresh.paymentId)).toEqual([]);
      expect(await reversals(fresh.paymentId)).toEqual([
        expect.objectContaining({ amountCents: pounds(500), sellerAmountCents: 0 }),
      ]);

      // Charged in full by the previous release before payout, then failed before payout: the
      // whole charge comes back, so the run has nothing to true up.
      const old = await seedSale({
        hammer: 1_000,
        premium: 250,
        commissionPercent: "15.00",
        raised: "agreement",
      });
      const oldCharge = await cardPayment(old.paymentId);
      const oldRefund = `re_terms_${run}_${randomUUID()}`;
      await oldReleaseFullCharge(old.paymentId, `old-release-${old.paymentId}`);
      stripeRefunds.add({
        id: oldRefund,
        chargeId: oldCharge,
        amountPence: pounds(500),
        status: "failed",
      });
      await chargeRefunded(old.paymentId, oldCharge);
      expect(await giveBackLinesOf(old.paymentId)).toEqual([
        expect.objectContaining({ amount: "500.00", buyerRefundPence: -pounds(500) }),
      ]);
      expect(await reversals(old.paymentId)).toEqual([
        expect.objectContaining({ amountCents: pounds(500), sellerAmountCents: pounds(500) }),
      ]);

      await payOpenPayouts();
      const settled = await createSettlement(deps, null, {
        legalEntityId: sellerEntity,
        periodEnd: nextPeriodEnd(),
      });
      expect(settled.ok).toBe(true);
      if (!settled.ok) return;
      const lines = await linesOf(settled.payout.id);
      for (const paymentId of [fresh.paymentId, old.paymentId]) {
        // The sale is paid its £820.00 net, and no refund is charged or trued up.
        expect(lines.filter((l) => l.paymentId === paymentId)).toEqual([
          expect.objectContaining({ kind: "sale", amount: "1000.00" }),
        ]);
        expect(await refundLedger(paymentId)).toEqual({ chargedPence: 0, answeredPence: 0 });
        expect((await refundRecords.sumRefundedPence(paymentId)).pence).toBe(0);
      }
    });

    it("the webhook and the refund reconcile job racing over the failure give back once", async () => {
      const sale = await paidOutCardSale();
      const refundId = await cardRefund(sale.paymentId, sale.chargeId, pounds(500));
      await payOpenPayouts();
      stripeRefunds.setStatus(refundId, "failed");
      const job = new StripeRefundReconcileService({
        watch: {
          claimDue: async () => [
            {
              stripeRefundId: refundId,
              stripeChargeId: sale.chargeId,
              status: "succeeded",
              amountPence: pounds(500),
              paymentId: sale.paymentId,
              staffRefund: null,
              attempts: 0,
            },
          ],
          reschedule: async () => undefined,
          markSettled: async () => undefined,
        },
        refunds: stripeRefunds,
        settleCharge: (event, charge) => webhooks.handleChargeRefunded(event, charge),
        completeStaffRefund: async () => ok(undefined),
      });

      const [, summary] = await Promise.all([
        chargeRefunded(sale.paymentId, sale.chargeId),
        job.run(),
      ]);
      expect(summary).toMatchObject({ settled: 1, failed: 0 });

      expect(await giveBackLinesOf(sale.paymentId)).toEqual([
        expect.objectContaining({ amount: "328.00", buyerRefundPence: -pounds(500) }),
      ]);
      expect(await refundLedger(sale.paymentId)).toEqual({ chargedPence: 0, answeredPence: 0 });
      expect(await reversals(sale.paymentId)).toHaveLength(1);
    });

    it("lines the previous release wrote, with no buyer refund kept, add up with their sign", async () => {
      // Charged in full after payout by the previous release, then failed: all £500 comes back.
      const charged = await paidOutCardSale();
      await oldReleaseFullCharge(charged.paymentId, `old-release-${charged.paymentId}`);
      const failed = `re_terms_${run}_${randomUUID()}`;
      stripeRefunds.add({
        id: failed,
        chargeId: charged.chargeId,
        amountPence: pounds(500),
        status: "failed",
      });
      await chargeRefunded(charged.paymentId, charged.chargeId);
      expect(await giveBackLinesOf(charged.paymentId)).toEqual([
        expect.objectContaining({ amount: "500.00", buyerRefundPence: -pounds(500) }),
      ]);
      expect(await refundLedger(charged.paymentId)).toEqual({ chargedPence: 0, answeredPence: 0 });
      expect(await repo.sumRefundLineCentsForPayment(charged.paymentId)).toBe(0);
      expect(await topUpAdds(charged.paymentId)).toBe(0);
      expect(await reversals(charged.paymentId)).toEqual([
        expect.objectContaining({ sellerAmountCents: pounds(500) }),
      ]);
      // A later £250 refund is measured from what stands: nothing, so the share of £250.
      await payOpenPayouts();
      await cardRefund(charged.paymentId, charged.chargeId, pounds(250));
      expect(await refundLedger(charged.paymentId)).toEqual({
        chargedPence: pounds(164),
        answeredPence: pounds(250),
      });

      // The previous release's charge and its own compensating line for the failed refund: they
      // cancel, so the next refund is new and charged at the share.
      const compensated = await paidOutCardSale();
      await oldReleaseLine(compensated.paymentId, "-500.00", "Refund");
      await oldReleaseLine(compensated.paymentId, "500.00", "Refund failed");
      expect(await repo.sumRefundLineCentsForPayment(compensated.paymentId)).toBe(0);
      expect(await repo.findSellerClawbackFacts(compensated.paymentId)).toMatchObject({
        clawedBackPence: 0,
        buyerRefundAnsweredPence: 0,
      });
      await cardRefund(compensated.paymentId, compensated.chargeId, pounds(250));
      expect(await refundLedger(compensated.paymentId)).toEqual({
        chargedPence: pounds(164),
        answeredPence: pounds(250),
      });
    });
  });

  describe("a payout line never lands on a payout whose transfer has started", () => {
    /** The Stripe side of a transfer: none exists yet, and creating one can be held mid-call. */
    function fakeConnectStripe() {
      const created: number[] = [];
      let entered = () => {};
      let release = () => {};
      const createEntered = new Promise<void>((resolve) => {
        entered = resolve;
      });
      let gate: Promise<void> = Promise.resolve();
      const stripe = {
        transfers: {
          list: async () => ({ data: [], has_more: false }),
          create: async (params: { amount: number }) => {
            entered();
            await gate;
            created.push(params.amount);
            return { id: `tr_terms_${run}_${randomUUID()}` };
          },
        },
        charges: { retrieve: async () => ({ currency: "gbp" }) },
      };
      const holdCreate = () => {
        gate = new Promise<void>((resolve) => {
          release = resolve;
        });
      };
      const transfers = new ConnectTransferInitiationService(
        { warn: () => {}, error: () => {}, info: () => {} } as never,
        {
          findLegalEntityById: async () => ({ stripeConnectAccountId: "acct_terms" }),
          findStripeChargeIdByPaymentId: async () => null,
        } as never,
        { get: () => stripe } as never,
        { syncAccountFromStripe: async () => ({ ready: true }) } as never,
        repo,
        null,
        undefined,
        { runner },
      );
      return { transfers, created, createEntered, holdCreate, release: () => release() };
    }

    /** Waits until some session in this database is waiting for a row lock. */
    async function someoneWaitsForALock(timeoutMs = 2_000): Promise<boolean> {
      const until = Date.now() + timeoutMs;
      while (Date.now() < until) {
        const waiting = await db.execute<{ n: number }>(
          sql`SELECT count(*)::int AS n FROM pg_stat_activity
              WHERE datname = current_database() AND wait_event_type = 'Lock'`,
        );
        if (Number(waiting.rows[0]?.n) > 0) return true;
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      return false;
    }

    /** A card sale on a payout that is scheduled and not yet transferred. */
    async function scheduledCardSale() {
      const sale = await seedSale({
        hammer: 1_000,
        premium: 250,
        commissionPercent: "15.00",
        raised: "agreement",
      });
      await cardPayment(sale.paymentId);
      await payOpenPayouts();
      const settled = await createSettlement(deps, null, {
        legalEntityId: sellerEntity,
        periodEnd: nextPeriodEnd(),
      });
      if (!settled.ok) throw new Error("the sale was not paid out");
      const [saleLine] = await db
        .select({ payoutId: payoutLine.payoutId })
        .from(payoutLine)
        .where(and(eq(payoutLine.paymentId, sale.paymentId), eq(payoutLine.kind, "sale")));
      if (!saleLine) throw new Error("the sale has no payout line");
      return { ...sale, payoutId: saleLine.payoutId };
    }

    const payoutRow = async (id: string) => {
      const [row] = await db.select().from(payout).where(eq(payout.id, id));
      if (!row) throw new Error("payout not found");
      return row;
    };

    it("a dispute line and a refund on the same payment both land: the dispute waits for the payment, not the payout", async () => {
      const sale = await scheduledCardSale();
      const before = await payoutRow(sale.payoutId);

      // A staff refund holds the payment, as every refund path does, and has not reached the payout.
      let paymentHeld = () => {};
      const held = new Promise<void>((resolve) => {
        paymentHeld = resolve;
      });
      let goOn = () => {};
      const resumed = new Promise<void>((resolve) => {
        goOn = resolve;
      });
      const key = `staff-part-${randomUUID()}`;
      const refund = runner.runInTransaction(async (tx) => {
        await refundRecords.lockPaymentInTransaction(tx, sale.paymentId);
        await refundRecords.recordInTransaction(tx, {
          paymentId: sale.paymentId,
          idempotencyKey: key,
          amountPence: pounds(100),
          currency: "GBP",
          source: "staff",
        });
        paymentHeld();
        await resumed;
        await adjustments.addPaymentLineToOpenPayoutOrCreateClawback({
          legalEntityId: sellerEntity,
          paymentId: sale.paymentId,
          amount: "-100.00",
          kind: "refund",
          sourceEventId: key,
          note: "Part refund",
          tx,
        });
      });
      await held;

      // A dispute's funds are withdrawn on another connection: the dispute paths lock the case,
      // not the payment, so the line takes the payment itself before the payout.
      const disputeLine = adjustments.addPaymentLineToOpenPayoutOrCreateClawback({
        legalEntityId: sellerEntity,
        paymentId: sale.paymentId,
        amount: "-50.00",
        kind: "dispute",
        sourceEventId: `dispute:dp_${run}_${randomUUID()}:${sale.paymentId}:withdrawn`,
        note: "Dispute funds withdrawn",
      });
      const waited = await someoneWaitsForALock();
      goOn();
      const outcomes = await Promise.allSettled([refund, disputeLine]);

      expect(waited).toBe(true);
      // Neither side is aborted as a deadlock (40P01).
      const failures = outcomes.flatMap((o) =>
        o.status === "rejected" ? [String((o.reason as Error).cause ?? o.reason)] : [],
      );
      expect(failures).toEqual([]);
      const lines = await linesOf(sale.payoutId);
      expect(lines.map((l) => l.kind).sort()).toEqual(["dispute", "refund", "sale"]);
      const after = await payoutRow(sale.payoutId);
      expect(after.status).toBe("scheduled");
      // The payout's net moved by exactly the two new lines: nothing was lost or counted twice.
      const added = lines
        .filter((l) => l.kind !== "sale")
        .reduce((sum, l) => sum + pounds(Number(l.amount)), 0);
      expect(added).toBeLessThan(0);
      expect(pounds(Number(after.netAmount))).toBe(pounds(Number(before.netAmount)) + added);
    });

    it("after a transfer attempt whose outcome is unknown, a refund goes on a new payout and the next run sends what Stripe already holds", async () => {
      const sale = await scheduledCardSale();
      const scheduled = await payoutRow(sale.payoutId);
      // Stripe creates the transfer, but every answer is lost on the way back.
      const held: Stripe.Transfer[] = [];
      let answers = false;
      const stripe = {
        transfers: {
          list: async () => ({ data: held, has_more: false }),
          create: async (params: Stripe.TransferCreateParams) => {
            if (held.length === 0) {
              held.push({
                id: `tr_terms_${run}_${randomUUID()}`,
                amount: params.amount,
                amount_reversed: 0,
                currency: params.currency,
                destination: params.destination,
                transfer_group: params.transfer_group,
                metadata: params.metadata,
                reversed: false,
              } as unknown as Stripe.Transfer);
            }
            if (!answers) {
              throw new StripeSdk.errors.StripeConnectionError({ message: "socket hang up" });
            }
            return held[0];
          },
        },
        charges: { retrieve: async () => ({ currency: "gbp" }) },
      };
      const transfers = new ConnectTransferInitiationService(
        { warn: () => {}, error: () => {}, info: () => {} } as never,
        {
          findLegalEntityById: async () => ({ stripeConnectAccountId: "acct_terms" }),
          findStripeChargeIdByPaymentId: async () => null,
        } as never,
        { get: () => stripe } as never,
        { syncAccountFromStripe: async () => ({ ready: true }) } as never,
        repo,
        null,
        undefined,
        { runner },
      );
      const bulkRun = () =>
        transfers.initiateTransfer(sale.payoutId, { keepScheduledOnTransferFailure: true });

      await expect(bulkRun()).resolves.toMatchObject({ ok: false, reason: "stripe_error" });
      const unknown = await payoutRow(sale.payoutId);
      expect(unknown.status).toBe("scheduled");
      expect(unknown.failureReason).toMatch(new RegExp(`^${TRANSFER_OUTCOME_UNKNOWN_PREFIX}`));
      expect(await repo.findOpenPayoutForEntity(sellerEntity)).toBeNull();

      await partRefund(sale.paymentId, pounds(100));

      // The refund is charged on a payout of its own; the attempted one keeps the amount Stripe holds.
      const [refundLine] = await refundLinesOf(sale.paymentId);
      expect(refundLine?.payoutId).not.toBe(sale.payoutId);
      expect((await payoutRow(sale.payoutId)).netAmount).toBe(scheduled.netAmount);

      answers = true;
      await expect(bulkRun()).resolves.toMatchObject({ ok: true });
      const sent = await payoutRow(sale.payoutId);
      expect(sent).toMatchObject({ status: "in_transit", stripeTransferId: held[0]?.id });
      expect(held).toHaveLength(1);
      expect(held[0]?.amount).toBe(pounds(Number(sent.netAmount)));
    }, 30_000);

    it("a give-back for a failed refund while the payout it was charged on is in transit goes on a new payout", async () => {
      const sale = await paidOutCardSale();
      const refundId = await cardRefund(sale.paymentId, sale.chargeId, pounds(500));
      const [charge] = await refundLinesOf(sale.paymentId);
      if (!charge) throw new Error("the refund was not charged");
      // The charge's payout has started its transfer.
      await db
        .update(payout)
        .set({ status: "in_transit", stripeTransferId: `tr_terms_${run}_${randomUUID()}` })
        .where(eq(payout.id, charge.payoutId));
      const inTransit = await payoutRow(charge.payoutId);

      await refundFails(refundId, sale.paymentId, sale.chargeId);

      // The in-transit payout and its lines are as they were when the transfer started.
      expect(await payoutRow(charge.payoutId)).toMatchObject({
        status: "in_transit",
        netAmount: inTransit.netAmount,
      });
      expect(await linesOf(charge.payoutId)).toEqual([
        expect.objectContaining({ id: charge.id, amount: "-328.00" }),
      ]);
      // The £328.00 comes back on a payout of its own, still to be transferred.
      const [giveBack] = await giveBackLinesOf(sale.paymentId);
      expect(giveBack).toMatchObject({ amount: "328.00", buyerRefundPence: -pounds(500) });
      expect(giveBack?.payoutId).not.toBe(charge.payoutId);
      expect(await payoutRow(giveBack?.payoutId ?? "")).toMatchObject({
        status: "scheduled",
        netAmount: "328.00",
      });
      expect(await refundLedger(sale.paymentId)).toEqual({ chargedPence: 0, answeredPence: 0 });
    });

    it("a refund that arrives while the transfer is being created waits, then goes to the next payout", async () => {
      const sale = await scheduledCardSale();
      const stripe = fakeConnectStripe();
      stripe.holdCreate();

      const transfer = stripe.transfers.initiateTransfer(sale.payoutId);
      await stripe.createEntered;
      // The transfer holds the payout while Stripe creates it; the refund starts on another
      // connection and must wait for it rather than change what is being sent.
      const refund = partRefund(sale.paymentId, pounds(100));
      const waited = await someoneWaitsForALock();
      stripe.release();
      await expect(transfer).resolves.toMatchObject({ ok: true });
      await refund;

      expect(waited).toBe(true);
      const transferred = await payoutRow(sale.payoutId);
      expect(transferred.status).toBe("in_transit");
      expect(stripe.created).toEqual([pounds(Number(transferred.netAmount))]);
      const refundLines = await refundLinesOf(sale.paymentId);
      expect(refundLines).toHaveLength(1);
      expect(refundLines[0]?.payoutId).not.toBe(sale.payoutId);
      expect(await payoutRow(refundLines[0]?.payoutId ?? "")).toMatchObject({
        status: "scheduled",
      });
    });

    it("a refund that holds the payout first is sent with it: the transfer that read the old amount stops, the next sends the new net", async () => {
      const sale = await scheduledCardSale();
      const before = await payoutRow(sale.payoutId);
      const stripe = fakeConnectStripe();

      let lineAdded = () => {};
      const added = new Promise<void>((resolve) => {
        lineAdded = resolve;
      });
      let commit = () => {};
      const committed = new Promise<void>((resolve) => {
        commit = resolve;
      });
      const key = `staff-part-${randomUUID()}`;
      const refund = runner.runInTransaction(async (tx) => {
        await refundRecords.lockPaymentInTransaction(tx, sale.paymentId);
        await refundRecords.recordInTransaction(tx, {
          paymentId: sale.paymentId,
          idempotencyKey: key,
          amountPence: pounds(100),
          currency: "GBP",
          source: "staff",
        });
        await adjustments.addPaymentLineToOpenPayoutOrCreateClawback({
          legalEntityId: sellerEntity,
          paymentId: sale.paymentId,
          amount: "-100.00",
          kind: "refund",
          sourceEventId: key,
          note: "Part refund",
          tx,
        });
        lineAdded();
        await committed;
      });
      await added;

      // The transfer reads the payout before the refund commits, then waits for its row.
      const first = stripe.transfers.initiateTransfer(sale.payoutId);
      const waited = await someoneWaitsForALock();
      commit();
      await refund;

      expect(waited).toBe(true);
      await expect(first).resolves.toEqual({ ok: false, reason: "payout_changed" });
      expect(stripe.created).toEqual([]);
      const changed = await payoutRow(sale.payoutId);
      expect(changed.status).toBe("scheduled");
      expect(changed.netAmount).not.toBe(before.netAmount);
      expect((await refundLinesOf(sale.paymentId))[0]?.payoutId).toBe(sale.payoutId);

      await expect(stripe.transfers.initiateTransfer(sale.payoutId)).resolves.toMatchObject({
        ok: true,
      });
      const transferred = await payoutRow(sale.payoutId);
      expect(transferred.status).toBe("in_transit");
      expect(stripe.created).toEqual([pounds(Number(transferred.netAmount))]);
    });
  });
});
