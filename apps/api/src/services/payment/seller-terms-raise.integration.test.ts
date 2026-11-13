import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import {
  bidFinanceSetting,
  bidInvoice,
  bidInvoiceLine,
  consignmentAgreement,
  itemSubmission,
  legalEntity,
  lot,
  payment,
  saleSellerTerms,
} from "@auction/db/schema";
import { parsePaymentTierLimits } from "@auction/domain";
import {
  InvoiceRaiser,
  LotInvoiceInitiationService,
  PaymentTierPolicy,
  createSellerTermsAtRaise,
} from "@auction/finance-runtime";
import {
  DrizzleBidInvoiceRepository,
  DrizzleCommissionVatSettingReader,
  DrizzleLotRepository,
  DrizzlePaymentRepository,
  DrizzleSellerTermsFactsReader,
} from "@auction/persistence/repositories";
import type { Lot } from "@auction/types";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  deleteIdentityUserFixtures,
  seedIdentityUserFixtures,
} from "../../testing/identity-user-fixtures.js";
import {
  computeNewPaymentTerms,
  createPaymentRecordForWinner,
} from "./create-pending-for-winner.pipeline.js";
import type { PaymentServiceDeps } from "./payment-service-types.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

type AgreementSeed = {
  commissionPercent?: string | null;
  accepted?: boolean;
  /** The account the agreement was made with; the lot's seller when left out. */
  entity?: string;
};

/**
 * What a seller is paid is fixed when the buyer's invoice is raised, by both paths that raise one
 * (the lot-end job and checkout), from the lot's signed agreement, in the invoice's transaction.
 * These run against a real database: the agreement chain, the stored snapshot and its constraints.
 */
describe.skipIf(!HAS_DB)("seller terms at raise (integration)", () => {
  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);
  const invoices = new DrizzleBidInvoiceRepository(db);
  const payments = new DrizzlePaymentRepository(db);
  const lots = new DrizzleLotRepository(db);
  const raiser = new InvoiceRaiser({ invoices, sales: null });
  const sellerTermsFor = (handle: typeof db) =>
    createSellerTermsAtRaise({
      facts: new DrizzleSellerTermsFactsReader(handle),
      vatSetting: new DrizzleCommissionVatSettingReader(handle),
      legalEntities: null,
    });
  const sellerTerms = sellerTermsFor(db);

  const day = 86_400_000;
  const buyerId = `terms-buyer-${randomUUID()}`;
  const buyerEntity = randomUUID();
  const sellerEntity = randomUUID();
  const otherEntity = randomUUID();
  const laxStockEntity = randomUUID();
  const lotIds: string[] = [];
  const submissionIds: string[] = [];

  async function newLot(options: {
    price?: string;
    seller?: string;
    agreement?: AgreementSeed | null;
  }) {
    const seller = options.seller ?? sellerEntity;
    const id = randomUUID();
    lotIds.push(id);
    await db.insert(lot).values({
      id,
      title: `Terms ${id.slice(0, 6)}`,
      images: [],
      auctionType: "english",
      startingPrice: "100.00",
      currentPrice: options.price ?? "1000.00",
      // The lot's own 25% premium: the figures below are worked at it.
      buyerPremiumRate: "0.25",
      minBidIncrement: "10.00",
      startTime: new Date(Date.now() - 10 * day),
      endTime: new Date(Date.now() - 2 * day),
      status: "ended",
      sellerLegalEntityId: seller,
      winnerId: buyerId,
      buyerLegalEntityId: buyerEntity,
    });
    if (options.agreement !== null && options.agreement !== undefined) {
      const submissionId = randomUUID();
      submissionIds.push(submissionId);
      await db.insert(itemSubmission).values({
        id: submissionId,
        legalEntityId: seller,
        title: "Consigned work",
        convertedLotId: id,
      });
      await db.insert(consignmentAgreement).values({
        submissionId,
        legalEntityId: options.agreement.entity ?? seller,
        termsVersion: "v1",
        commissionPercent:
          options.agreement.commissionPercent === undefined
            ? "15.00"
            : options.agreement.commissionPercent,
        acceptedAt: options.agreement.accepted === false ? null : new Date("2026-10-01T10:00:00Z"),
      });
    }
    const found = await lots.findById(id);
    if (!found) throw new Error("lot was not stored");
    return found;
  }

  const termsOf = async (lotId: string) => {
    const [row] = await db.select().from(saleSellerTerms).where(eq(saleSellerTerms.lotId, lotId));
    return row;
  };

  function lotEndService(l: Lot) {
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
          STRIPE_CARD_CHECKOUT_MAX: 1_000_000,
          STRIPE_MANUAL_REVIEW_MIN: 5_000_000,
          STRIPE_ABSOLUTE_MAX: 9_999_999.99,
        }),
      ),
      sellerTerms,
      { isConfigured: () => false, ensureInvoiceForPayment: async () => ({ ok: true }) } as never,
      { stageDispatch: async () => undefined },
      {
        createPaymentDue: () =>
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

  /** Checkout's two steps, as the pipeline runs them: work out the terms, then raise. */
  async function raiseAtCheckout(l: Lot) {
    const deps = {
      invoiceRaiser: raiser,
      sellerTerms,
      payments,
      legalEntityRepository: null,
      settlementCompliance: null,
      paymentTierPolicy: new PaymentTierPolicy(
        parsePaymentTierLimits({
          STRIPE_CARD_CHECKOUT_MAX: 1_000_000,
          STRIPE_MANUAL_REVIEW_MIN: 5_000_000,
          STRIPE_ABSOLUTE_MAX: 9_999_999.99,
        }),
      ),
    } as unknown as PaymentServiceDeps;
    const terms = (await computeNewPaymentTerms(deps, l, buyerId))._unsafeUnwrap();
    return createPaymentRecordForWinner(deps, l, buyerId, terms);
  }

  beforeAll(async () => {
    await seedIdentityUserFixtures(db, [
      { id: buyerId, name: buyerId, email: `${buyerId}@integration.test` },
    ]);
    for (const [id, kind, subkind] of [
      [buyerEntity, "individual", "private_collector"],
      [sellerEntity, "organisation", "gallery"],
      [otherEntity, "organisation", "gallery"],
      [laxStockEntity, "organisation", "lax_stock"],
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
      .where(inArray(legalEntity.id, [buyerEntity, sellerEntity, otherEntity, laxStockEntity]));
    await deleteIdentityUserFixtures(db, [buyerId]);
  });

  describe.each([
    ["the lot-end job", async (l: Lot) => (await lotEndService(l).ensureForLot(l.id)).paymentId],
    ["checkout", async (l: Lot) => (await raiseAtCheckout(l)).payment.id],
  ])("raised by %s", (_path, raise) => {
    it("stores the seller's terms with the payment: the agreement's rate on the hammer, plus VAT", async () => {
      // £82,000 hammer, 25% premium: the owner's example.
      const l = await newLot({ price: "82000.00", agreement: {} });
      const paymentId = await raise(l);

      const row = await termsOf(l.id);
      expect(row).toMatchObject({
        paymentId,
        lotId: l.id,
        sellerLegalEntityId: sellerEntity,
        basis: "agreement",
        heldReason: null,
        hammerPence: 8_200_000,
        premiumPence: 2_050_000,
        commissionBps: 1500,
        commissionPence: 1_230_000,
        commissionVatTreatment: "standard",
        commissionVatBps: 2000,
        commissionVatPence: 246_000,
        otherCharges: [],
        sellerNetPence: 6_724_000,
        // The payment's old-rule fee, kept beside the new figures for reconciliation.
        legacyPlatformFeePence: 512_500,
        ruleVersion: "agreement_hammer_v1",
        source: "raised",
      });
      expect(row?.agreementId).toBeTruthy();
    });

    it("leaves what the buyer pays, and the payment's platform fee, as they were", async () => {
      const l = await newLot({ price: "82000.00", agreement: {} });
      const paymentId = await raise(l);
      const [paid] = await db
        .select()
        .from(payment)
        .where(eq(payment.id, paymentId as string));
      expect(Number(paid?.amount)).toBe(102_500);
      // Still the old figure (5% of what the buyer pays) until settlement pays from the terms.
      expect(Number(paid?.platformFee)).toBe(5_125);
    });

    it.each([
      ["has no agreement", null, "no_agreement"],
      ["has an agreement the seller has not accepted", { accepted: false }, "not_accepted"],
      ["has an agreement with no commission", { commissionPercent: null }, "no_commission"],
      ["has an agreement made with another account", { entity: otherEntity }, "other_seller"],
    ] as const)(
      "holds the sale when the lot %s, and still raises the invoice",
      async (_name, agreement, reason) => {
        const l = await newLot({ agreement });
        const paymentId = await raise(l);
        expect(paymentId).toBeTruthy();
        expect(await termsOf(l.id)).toMatchObject({
          basis: "held",
          heldReason: reason,
          agreementId: null,
          commissionPence: null,
          sellerNetPence: null,
          hammerPence: 100_000,
          premiumPence: 25_000,
        });
      },
    );

    it("raises a new payment on a live legacy invoice with no hammer line, holding the seller's side", async () => {
      // Backfilled by migration 0319: one legacy_total line, below the lot's current price, and
      // a payment on it that has expired. The buyer still pays the stored total.
      const l = await newLot({ price: "1000.00", agreement: {} });
      const [invoice] = await db
        .insert(bidInvoice)
        .values({
          lotId: l.id,
          buyerLegalEntityId: buyerEntity,
          sellerLegalEntityId: sellerEntity,
          totalPence: 99_900,
          raisedAt: new Date(Date.now() - 2 * day),
          dueAt: new Date(Date.now() + 5 * day),
        })
        .returning({ id: bidInvoice.id });
      if (!invoice) throw new Error("invoice was not stored");
      await db.insert(bidInvoiceLine).values({
        invoiceId: invoice.id,
        position: 1,
        kind: "legacy_total",
        label: "Total",
        amountPence: 99_900,
      });
      const [expired] = await db
        .insert(payment)
        .values({
          lotId: l.id,
          buyerId,
          buyerLegalEntityId: buyerEntity,
          sellerLegalEntityId: sellerEntity,
          amount: "999.00",
          platformFee: "49.95",
          status: "cancelled",
          invoiceId: invoice.id,
        })
        .returning({ id: payment.id });

      const paymentId = await raise(l);
      expect(paymentId).toBeTruthy();
      expect(paymentId).not.toBe(expired?.id);

      const [paid] = await db
        .select()
        .from(payment)
        .where(eq(payment.id, paymentId as string));
      expect(paid?.invoiceId).toBe(invoice.id);
      expect(Number(paid?.amount)).toBe(999);
      // The legacy fee on the total, as before this change.
      expect(Number(paid?.platformFee)).toBe(49.95);

      const rows = await db.select().from(saleSellerTerms).where(eq(saleSellerTerms.lotId, l.id));
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        paymentId,
        basis: "held",
        heldReason: "legacy_invoice",
        agreementId: null,
        hammerPence: 0,
        premiumPence: 0,
        commissionPence: null,
        sellerNetPence: null,
        legacyPlatformFeePence: 4_995,
      });
    });

    it("pays LAX-owned stock no commission and no seller line", async () => {
      const l = await newLot({ seller: laxStockEntity, agreement: null });
      await raise(l);
      expect(await termsOf(l.id)).toMatchObject({
        basis: "lax_owned",
        agreementId: null,
        commissionPence: null,
        sellerNetPence: null,
        hammerPence: 100_000,
        premiumPence: 25_000,
      });
    });
  });

  it("gives a retry on a live invoice its own terms with its own payment", async () => {
    const l = await newLot({ agreement: {} });
    const first = await raiseAtCheckout(l);
    await payments.updateStatus(first.payment.id, "cancelled");
    const retry = await raiseAtCheckout(l);
    expect(retry.invoiceCreated).toBe(false);
    const rows = await db.select().from(saleSellerTerms).where(eq(saleSellerTerms.lotId, l.id));
    expect(rows.map((r) => r.paymentId).sort()).toEqual(
      [first.payment.id, retry.payment.id].sort(),
    );
    expect(rows.every((r) => r.basis === "agreement" && r.hammerPence === 100_000)).toBe(true);
  });

  it("prefers the seller's own agreement when two submissions point at the lot", async () => {
    const l = await newLot({ agreement: { commissionPercent: "12.50" } });
    // Another account's submission, converted into the same lot and accepted later.
    const otherSubmission = randomUUID();
    submissionIds.push(otherSubmission);
    await db.insert(itemSubmission).values({
      id: otherSubmission,
      legalEntityId: otherEntity,
      title: "Another consignment",
      convertedLotId: l.id,
    });
    await db.insert(consignmentAgreement).values({
      submissionId: otherSubmission,
      legalEntityId: otherEntity,
      termsVersion: "v1",
      commissionPercent: "20.00",
      acceptedAt: new Date("2026-10-05T10:00:00Z"),
    });
    const reader = new DrizzleSellerTermsFactsReader(db);
    expect(await reader.agreementForLot(l.id, sellerEntity)).toMatchObject({
      legalEntityId: sellerEntity,
      commissionPercent: "12.50",
    });
    // With no agreement of the seller's own, the other account's shows (and is held as such).
    expect(await reader.agreementForLot(l.id, laxStockEntity)).toMatchObject({
      legalEntityId: otherEntity,
    });
  });

  it("stores no terms and no payment when the raise fails", async () => {
    const l = await newLot({ agreement: {} });
    await raiseAtCheckout(l);
    // A second open payment is refused by the database; its terms must not be left behind.
    await expect(raiseAtCheckout(l)).rejects.toBeTruthy();
    const rows = await db.select().from(saleSellerTerms).where(eq(saleSellerTerms.lotId, l.id));
    expect(rows).toHaveLength(1);
  });

  describe("the Bid company's VAT setting", () => {
    /** Each probe changes the setting inside a transaction that is rolled back. */
    async function withSetting(
      value: string | null,
      read: (r: DrizzleCommissionVatSettingReader, handle: typeof db) => Promise<unknown>,
    ) {
      const rollback = new Error("rollback");
      let got: unknown;
      await db
        .transaction(async (tx) => {
          const handle = tx as unknown as typeof db;
          if (value === null) {
            await handle
              .delete(bidFinanceSetting)
              .where(eq(bidFinanceSetting.key, "commission_vat_treatment"));
          } else {
            await handle
              .update(bidFinanceSetting)
              .set({ value })
              .where(eq(bidFinanceSetting.key, "commission_vat_treatment"));
          }
          got = await read(new DrizzleCommissionVatSettingReader(handle), handle);
          throw rollback;
        })
        .catch((e) => {
          if (e !== rollback) throw e;
        });
      return got;
    }

    it("holds a sale when the setting is missing, and charges no VAT when not registered", async () => {
      const l = await newLot({ price: "6200.00", agreement: {} });
      const priced = await raiser.price(l);
      const atRaise = (handle: typeof db) => sellerTermsFor(handle).forInvoice({ lot: l, priced });

      expect(
        (await withSetting(null, (_reader, handle) => atRaise(handle))) as never,
      ).toMatchObject({
        sellerTerms: { basis: "held", heldReason: "vat_setting_missing" },
      });
      expect(
        (await withSetting("not_registered", (_reader, handle) => atRaise(handle))) as never,
      ).toMatchObject({
        sellerTerms: {
          basis: "agreement",
          commissionPence: 93_000,
          commissionVatTreatment: "not_registered",
          commissionVatBps: 0,
          commissionVatPence: 0,
          sellerNetPence: 527_000,
        },
      });
    });

    it("starts as standard-rated VAT", async () => {
      expect(await new DrizzleCommissionVatSettingReader(db).read()).toBe("standard");
    });

    it.each([
      ["not_registered", "not_registered"],
      ["standard", "standard"],
      [null, null],
    ] as const)("reads %s as %s, and a missing row as not set", async (stored, expected) => {
      expect(await withSetting(stored, (reader) => reader.read())).toBe(expected);
    });
  });
});
