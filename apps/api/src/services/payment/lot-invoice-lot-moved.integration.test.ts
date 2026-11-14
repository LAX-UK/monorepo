import { randomUUID } from "node:crypto";
import { type Database, createDb } from "@auction/db";
import {
  bidInvoice,
  buyerDefault,
  legalEntity,
  lot,
  lotFulfilment,
  payment,
} from "@auction/db/schema";
import { parsePaymentTierLimits } from "@auction/domain";
import {
  InvoiceRaiser,
  LotInvoiceInitiationService,
  PaymentTierPolicy,
} from "@auction/finance-runtime";
import { BidInvoiceLotMovedError, type ILotRepository } from "@auction/persistence/interfaces";
import {
  DrizzleBidInvoiceRepository,
  DrizzleBuyerDefaultRepository,
  DrizzleLotRepository,
  DrizzlePaymentRepository,
} from "@auction/persistence/repositories";
import type { Lot } from "@auction/types";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  deleteIdentityUserFixtures,
  seedIdentityUserFixtures,
} from "../../testing/identity-user-fixtures.js";
import { heldSellerTerms, sellerTermsForTests } from "../../testing/seller-terms.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);
/**
 * The connection the raise runs on. With `INVOICE_RAISE_DATABASE_URL` set to a `worker_app` or
 * `api_app` URL the lock and the inserts run under that role's grants; fixtures and the default
 * always use `DATABASE_URL`.
 */
const RAISE_URL = process.env.INVOICE_RAISE_DATABASE_URL || process.env.DATABASE_URL;

/**
 * The lot-end job reads the lot, prices it and only then raises the invoice. A buyer default that
 * lands in between must win: the raise locks the lot first (as the default does) and refuses, so
 * the defaulter is never left with a live invoice and a pending payment for a lot they lost.
 */
describe.skipIf(!HAS_DB)("raising an invoice for a lot that moved (integration)", () => {
  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);
  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const appDb = createDb(RAISE_URL!);
  const invoices = new DrizzleBidInvoiceRepository(appDb);
  const payments = new DrizzlePaymentRepository(appDb);
  const lotRepository = new DrizzleLotRepository(appDb);
  const defaults = new DrizzleBuyerDefaultRepository(db);
  const raiser = new InvoiceRaiser({ invoices, sales: null });

  const day = 86_400_000;
  const buyerId = `moved-buyer-${randomUUID()}`;
  const staffId = `moved-staff-${randomUUID()}`;
  const buyerEntity = randomUUID();
  const sellerEntity = randomUUID();
  const lotIds: string[] = [];

  async function newLot(): Promise<string> {
    const id = randomUUID();
    lotIds.push(id);
    await db.insert(lot).values({
      id,
      title: `Moved ${id.slice(0, 6)}`,
      images: [],
      auctionType: "english",
      startingPrice: "100.00",
      currentPrice: "1000.00",
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

  const defaultInput = (lotId: string) => ({
    lotId,
    buyerId,
    buyerLegalEntityId: buyerEntity,
    sellerLegalEntityId: sellerEntity,
    // No invoice was raised, so there is no payment to void.
    paymentId: null,
    hammerPrice: "1000.00",
    wonAt: new Date(Date.now() - 2 * day),
    reason: "No payment",
    outcome: "returned_to_inventory" as const,
    buyerRestricted: false,
    actorUserId: staffId,
  });

  const recordDefault = (lotId: string) =>
    db.transaction((tx) => defaults.record(tx as unknown as Database, defaultInput(lotId)));

  function lotEndService(lots: ILotRepository, stageDispatch = vi.fn(async () => undefined)) {
    return new LotInvoiceInitiationService(
      lots,
      raiser,
      payments,
      {
        evaluate: async () => ({ hold: false, reason: null }),
        peek: async () => ({ hold: false, reason: null }),
      },
      new PaymentTierPolicy(
        parsePaymentTierLimits({
          STRIPE_CARD_CHECKOUT_MAX: 10_000,
          STRIPE_MANUAL_REVIEW_MIN: 500_000,
          STRIPE_ABSOLUTE_MAX: 999_999.99,
        }),
      ),
      sellerTermsForTests(),
      { isConfigured: () => false, ensureInvoiceForPayment: async () => ({ ok: true }) } as never,
      { stageDispatch },
      {
        createPaymentDue: (l: Lot) =>
          ({
            type: "payment_due",
            title: "Payment due",
            message: "Payment due",
            lotId: l.id,
            submissionId: null,
            legalEntityId: null,
          }) as never,
      },
      { publish: async () => undefined },
      null,
      null,
      {
        findById: async () => ({ id: buyerId, email: `${buyerId}@integration.test`, name: "B" }),
      } as never,
      { forInvoice: async ({ winnerUserId }) => [winnerUserId] },
    );
  }

  async function stored(lotId: string) {
    const [lotRow] = await db.select().from(lot).where(eq(lot.id, lotId));
    const invoiceRows = await db.select().from(bidInvoice).where(eq(bidInvoice.lotId, lotId));
    const paymentRows = await db.select().from(payment).where(eq(payment.lotId, lotId));
    return { lotRow, invoiceRows, paymentRows };
  }

  beforeAll(async () => {
    await seedIdentityUserFixtures(db, [
      { id: buyerId, name: buyerId, email: `${buyerId}@integration.test` },
      { id: staffId, name: staffId, email: `${staffId}@integration.test` },
    ]);
    for (const [id, kind, subkind] of [
      [buyerEntity, "individual", "private_collector"],
      [sellerEntity, "organisation", "gallery"],
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
    await db.delete(buyerDefault).where(inArray(buyerDefault.lotId, lotIds));
    await db.delete(lotFulfilment).where(inArray(lotFulfilment.lotId, lotIds));
    await db.delete(payment).where(inArray(payment.lotId, lotIds));
    await db.delete(bidInvoice).where(inArray(bidInvoice.lotId, lotIds));
    await db.delete(lot).where(inArray(lot.id, lotIds));
    await db.delete(legalEntity).where(inArray(legalEntity.id, [buyerEntity, sellerEntity]));
    await deleteIdentityUserFixtures(db, [buyerId, staffId]);
  });

  it("raises the invoice and payment for the lot's winner when nothing moved", async () => {
    const lotId = await newLot();
    const stageDispatch = vi.fn(async () => undefined);

    const result = await lotEndService(lotRepository, stageDispatch).ensureForLot(lotId);

    expect(result.created).toBe(true);
    const { invoiceRows, paymentRows } = await stored(lotId);
    expect(invoiceRows).toHaveLength(1);
    expect(paymentRows).toHaveLength(1);
    expect(paymentRows[0]?.buyerId).toBe(buyerId);
    expect(paymentRows[0]?.status).toBe("pending");
    expect(stageDispatch).toHaveBeenCalledTimes(1);
  });

  it("a default recorded after the lot was read refuses the raise: no invoice, no payment, no notice", async () => {
    const lotId = await newLot();
    const stageDispatch = vi.fn(async () => undefined);
    // The job reads the lot (winner B), then staff record B's default before it raises.
    const staleRead: ILotRepository = Object.create(lotRepository, {
      findById: {
        value: async (id: string) => {
          const read = await lotRepository.findById(id);
          await recordDefault(id);
          return read;
        },
      },
    });

    const result = await lotEndService(staleRead, stageDispatch).ensureForLot(lotId);

    expect(result).toEqual({ created: false, reason: "lot_moved", lotId });
    const { lotRow, invoiceRows, paymentRows } = await stored(lotId);
    expect(lotRow?.winnerId).toBeNull();
    expect(invoiceRows).toHaveLength(0);
    expect(paymentRows).toHaveLength(0);
    expect(stageDispatch).not.toHaveBeenCalled();
  });

  it("a raise that reaches the lot while a default holds it waits, then refuses", async () => {
    const lotId = await newLot();
    const read = await lotRepository.findById(lotId);
    if (!read) throw new Error("lot was not stored");
    const priced = await raiser.price(read);

    let releaseDefault: () => void = () => {};
    const defaultHeld = new Promise<void>((resolve) => {
      releaseDefault = resolve;
    });
    let defaultLocked: () => void = () => {};
    const lockTaken = new Promise<void>((resolve) => {
      defaultLocked = resolve;
    });
    const defaulting = db.transaction(async (tx) => {
      await defaults.record(tx as unknown as Database, defaultInput(lotId));
      defaultLocked();
      await defaultHeld;
    });
    await lockTaken;

    let settled = false;
    const raising = raiser
      .raise({
        lot: read,
        priced,
        sellerTerms: heldSellerTerms(lotId, sellerEntity),
        payment: {
          lotId,
          paidByUserId: buyerId,
          buyerLegalEntityId: buyerEntity,
          sellerLegalEntityId: sellerEntity,
          platformFee: "0.00",
          stripePaymentIntentId: null,
        },
      })
      .finally(() => {
        settled = true;
      });
    // Attach the assertion now: the raise rejects the moment the default commits, which can be
    // before this test reaches its own await, and a rejection nobody is listening to is reported
    // as unhandled and fails the whole run.
    const refusal = expect(raising).rejects.toBeInstanceOf(BidInvoiceLotMovedError);
    // The raise is blocked on the lot row the default holds.
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(settled).toBe(false);

    releaseDefault();
    await defaulting;
    await refusal;

    const { invoiceRows, paymentRows } = await stored(lotId);
    expect(invoiceRows).toHaveLength(0);
    expect(paymentRows).toHaveLength(0);
  });

  it("refuses a raise for a winner the lot no longer has, even with the same account", async () => {
    const lotId = await newLot();
    const read = await lotRepository.findById(lotId);
    if (!read) throw new Error("lot was not stored");
    const priced = await raiser.price(read);

    await expect(
      raiser.raise({
        lot: { ...read, winnerId: staffId },
        priced,
        sellerTerms: heldSellerTerms(lotId, sellerEntity),
        payment: {
          lotId,
          paidByUserId: staffId,
          buyerLegalEntityId: buyerEntity,
          sellerLegalEntityId: sellerEntity,
          platformFee: "0.00",
          stripePaymentIntentId: null,
        },
      }),
    ).rejects.toBeInstanceOf(BidInvoiceLotMovedError);
    expect((await stored(lotId)).paymentRows).toHaveLength(0);
  });
});
