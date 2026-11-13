import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { bidInvoice, domainEvent, legalEntity, lot, payment, sale } from "@auction/db/schema";
import { InvoiceRaiser } from "@auction/finance-runtime";
import {
  DrizzleBidInvoiceRepository,
  DrizzleLotRepository,
  DrizzleRepositoryFactory,
  DrizzleSaleRepository,
} from "@auction/persistence/repositories";
import { standardBuyerPremiumBands } from "@auction/validators";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { transactionRunnerFromDb } from "../test/transaction-runner-from-db.js";
import {
  deleteIdentityUserFixtures,
  seedIdentityUserFixtures,
} from "../testing/identity-user-fixtures.js";
import { heldSellerTerms } from "../testing/seller-terms.js";
import { DomainEventSink } from "./domain-event-sink.js";
import { DomainEventPublisher } from "./domain-event.publisher.js";
import { useSalePremiumForLots } from "./sale/sale-lot-premium.js";
import type { SaleServiceDeps } from "./sale/sale-types.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

/**
 * Invoices raised against the database charge the premium the resolver gives: a lot's own
 * premium, else its sale's bands (slice by slice), else its sale's flat rate, and the published
 * standard for a lot outside any sale. Putting lots back on the sale's premium changes only
 * unsold lots that have not opened, and is recorded.
 */
describe.skipIf(!HAS_DB)("buyer's premium on raised invoices (integration)", () => {
  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);
  const invoices = new DrizzleBidInvoiceRepository(db);
  const saleRepo = new DrizzleSaleRepository(db);
  const lotRepo = new DrizzleLotRepository(db);
  const raiser = new InvoiceRaiser({ invoices, sales: saleRepo });

  const run = randomUUID().slice(0, 8);
  const buyerUserId = `bp-buyer-${run}`;
  const staffUserId = `bp-staff-${run}`;
  const buyerId = randomUUID();
  const sellerId = randomUUID();
  const bandedSaleId = randomUUID();
  const flatSaleId = randomUUID();

  const sold = {
    override: { id: randomUUID(), saleId: bandedSaleId, rate: "0.2000", hammer: "600000.00" },
    bands: { id: randomUUID(), saleId: bandedSaleId, rate: null, hammer: "600000.00" },
    flat: { id: randomUUID(), saleId: flatSaleId, rate: null, hammer: "600000.00" },
    blank: { id: randomUUID(), saleId: null, rate: null, hammer: "600000.00" },
  } as const;
  const draft = {
    differs: { id: randomUUID(), status: "draft" as const, rate: "0.2500" },
    usesSale: { id: randomUUID(), status: "draft" as const, rate: null },
    live: { id: randomUUID(), status: "active" as const, rate: "0.2500" },
    opensMidReset: { id: randomUUID(), status: "scheduled" as const, rate: "0.2500" },
    scheduled: { id: randomUUID(), status: "scheduled" as const, rate: "0.2000" },
  };
  const allLotIds = [...Object.values(sold), ...Object.values(draft)].map((l) => l.id);

  beforeAll(async () => {
    const now = new Date();
    const past = new Date(now.getTime() - 3 * 86_400_000);
    const ended = new Date(now.getTime() - 86_400_000);
    await seedIdentityUserFixtures(db, [
      { id: buyerUserId, name: "Buyer", email: `${buyerUserId}@integration.test` },
      { id: staffUserId, name: "Staff", email: `${staffUserId}@integration.test` },
    ]);
    await db.insert(legalEntity).values(
      [buyerId, sellerId].map((id) => ({
        id,
        displayName: id === buyerId ? "Buyer" : "Seller",
        kind: "individual" as const,
        subkind: "private_collector" as const,
        createdByUserId: buyerUserId,
        status: "approved" as const,
      })),
    );
    await db.insert(sale).values([
      {
        id: bandedSaleId,
        title: "Banded sale",
        status: "active",
        deliveryMode: "online",
        startTime: past,
        endTime: new Date(now.getTime() + 86_400_000),
        buyerPremiumRate: "0.25",
        buyerPremiumTiers: standardBuyerPremiumBands(),
        createdByLegalEntityId: sellerId,
      },
      {
        id: flatSaleId,
        title: "Flat sale",
        status: "active",
        deliveryMode: "online",
        startTime: past,
        endTime: ended,
        buyerPremiumRate: "0.18",
        createdByLegalEntityId: sellerId,
      },
    ]);
    const base = {
      images: [],
      auctionType: "english" as const,
      startingPrice: "10.00",
      minBidIncrement: "10.00",
      sellerLegalEntityId: sellerId,
    };
    await db.insert(lot).values([
      ...Object.values(sold).map((l) => ({
        ...base,
        id: l.id,
        saleId: l.saleId,
        title: `Sold ${l.id.slice(0, 4)}`,
        currentPrice: l.hammer,
        buyerPremiumRate: l.rate,
        startTime: past,
        endTime: ended,
        status: "ended" as const,
        winnerId: buyerUserId,
        buyerLegalEntityId: buyerId,
      })),
      ...Object.values(draft).map((l) => ({
        ...base,
        id: l.id,
        saleId: bandedSaleId,
        title: `Unsold ${l.id.slice(0, 4)}`,
        currentPrice: "0.00",
        buyerPremiumRate: l.rate,
        startTime: new Date(now.getTime() + 86_400_000),
        endTime: new Date(now.getTime() + 2 * 86_400_000),
        status: l.status,
      })),
    ]);
  });

  afterAll(async () => {
    await db.delete(payment).where(inArray(payment.lotId, allLotIds));
    await db.delete(bidInvoice).where(inArray(bidInvoice.lotId, allLotIds));
    await db.delete(lot).where(inArray(lot.id, allLotIds));
    await db.delete(domainEvent).where(inArray(domainEvent.aggregateId, [bandedSaleId]));
    await db.delete(sale).where(inArray(sale.id, [bandedSaleId, flatSaleId]));
    await db.delete(legalEntity).where(inArray(legalEntity.id, [buyerId, sellerId]));
    await deleteIdentityUserFixtures(db, [buyerUserId, staffUserId]);
  });

  async function raise(lotId: string) {
    const found = await lotRepo.findById(lotId);
    if (!found) throw new Error("lot not seeded");
    const priced = await raiser.price(found);
    return raiser.raise({
      lot: found,
      priced,
      sellerTerms: heldSellerTerms(lotId, sellerId),
      payment: {
        lotId,
        paidByUserId: buyerUserId,
        buyerLegalEntityId: buyerId,
        sellerLegalEntityId: sellerId,
        platformFee: "0.00",
        stripePaymentIntentId: null,
      },
    });
  }

  it.each([
    ["a lot's own premium over the sale's bands", "override", 12_000_000, "Buyer's premium (20%)"],
    [
      "the sale's bands for a lot without its own premium",
      "bands",
      8_500_000,
      "Buyer's premium (15% of £500,000 + 10% of £100,000)",
    ],
    ["the sale's flat rate", "flat", 10_800_000, "Buyer's premium (18%)"],
    [
      "the standard premium for a lot outside any sale",
      "blank",
      8_500_000,
      "Buyer's premium (15% of £500,000 + 10% of £100,000)",
    ],
  ] as const)("a £600,000 hammer charges %s", async (_name, key, premiumPence, label) => {
    const { invoice, payment: paid } = await raise(sold[key].id);
    const premium = invoice.lines.find((line) => line.kind === "buyers_premium");
    expect(premium?.amountPence).toBe(premiumPence);
    expect(premium?.label).toBe(label);
    expect(invoice.totalPence).toBe(60_000_000 + premiumPence);
    expect(Math.round(Number(paid.amount) * 100)).toBe(invoice.totalPence);
  });

  it("public pages read each sold lot's invoiced hammer and premium, in one read", async () => {
    const prices = await invoices.findInvoicedSalePrices([
      sold.override.id,
      sold.bands.id,
      draft.differs.id,
    ]);
    expect(prices.get(sold.override.id)).toEqual({
      hammerPence: 60_000_000,
      premiumPence: 12_000_000,
      pricingPolicyId: "flat:0.2000",
    });
    expect(prices.get(sold.bands.id)).toMatchObject({ premiumPence: 8_500_000 });
    expect(prices.has(draft.differs.id)).toBe(false);
  });

  it("ignores an invoice once the lot has moved to another buyer account", async () => {
    await db.update(lot).set({ buyerLegalEntityId: sellerId }).where(eq(lot.id, sold.flat.id));
    try {
      expect((await invoices.findInvoicedSalePrices([sold.flat.id])).size).toBe(0);
    } finally {
      await db.update(lot).set({ buyerLegalEntityId: buyerId }).where(eq(lot.id, sold.flat.id));
    }
  });

  it("a lot stored without a premium reads back as using its sale's", async () => {
    const row = await lotRepo.findById(sold.bands.id);
    expect(row?.buyerPremiumRate).toBeNull();
  });

  it("puts only unsold, not-yet-open lots back on the sale's premium, and records it", async () => {
    const published: unknown[] = [];
    const deps = {
      saleRepo,
      lotRepo,
      transactionRunner: null,
      repoFactory: null,
      domainEventSink: {
        publish: async (event: unknown) => {
          published.push(event);
        },
        withTx: () => ({ publish: async () => {} }),
      },
    } as unknown as SaleServiceDeps;
    const outcome = await useSalePremiumForLots(deps, {
      actorUserId: staffUserId,
      userRole: "staff",
      userStaffRoles: ["administrator"],
      saleId: bandedSaleId,
      lotIds: [draft.differs.id, draft.usesSale.id, draft.live.id, sold.override.id],
    });
    expect(outcome.isOk()).toBe(true);
    expect(outcome._unsafeUnwrap()).toEqual({
      updatedLotIds: [draft.differs.id],
      skipped: [
        { lotId: draft.usesSale.id, reason: "already_uses_sale" },
        { lotId: draft.live.id, reason: "not_editable" },
        { lotId: sold.override.id, reason: "not_editable" },
      ],
    });
    expect((await lotRepo.findById(draft.differs.id))?.buyerPremiumRate).toBeNull();
    expect((await lotRepo.findById(draft.live.id))?.buyerPremiumRate).toBe("0.2500");
    expect((await lotRepo.findById(sold.override.id))?.buyerPremiumRate).toBe("0.2000");
    expect(published).toEqual([
      expect.objectContaining({
        eventType: "sale.lot_premiums_reset",
        aggregateId: bandedSaleId,
        actorUserId: staffUserId,
        payload: {
          lot_ids: [draft.differs.id],
          previous_rates: { [draft.differs.id]: "0.2500" },
          differed_from_sale: 1,
        },
      }),
    ]);
  });

  it("refuses people who may not edit the catalogue", async () => {
    const deps = { saleRepo, lotRepo } as unknown as SaleServiceDeps;
    const outcome = await useSalePremiumForLots(deps, {
      actorUserId: buyerUserId,
      userRole: "client",
      saleId: bandedSaleId,
      lotIds: [draft.differs.id],
    });
    expect(outcome.isErr()).toBe(true);
  });

  it("re-checks each lot inside the transaction: a lot that opens mid-reset keeps its premium", async () => {
    // The lot list is read, then the lot opens for bidding before the write: the race the
    // in-transaction check exists for.
    const racingLotRepo = Object.assign(Object.create(lotRepo) as DrizzleLotRepository, {
      findBySaleId: async (saleId: string) => {
        const rows = await lotRepo.findBySaleId(saleId);
        await db.update(lot).set({ status: "active" }).where(eq(lot.id, draft.opensMidReset.id));
        return rows;
      },
    });
    const deps = {
      saleRepo,
      lotRepo: racingLotRepo,
      transactionRunner: transactionRunnerFromDb(db),
      repoFactory: new DrizzleRepositoryFactory(db),
      domainEventSink: new DomainEventSink(new DomainEventPublisher(), db),
    } as unknown as SaleServiceDeps;
    const outcome = await useSalePremiumForLots(deps, {
      actorUserId: staffUserId,
      userRole: "staff",
      userStaffRoles: ["administrator"],
      saleId: bandedSaleId,
      lotIds: [draft.opensMidReset.id, draft.scheduled.id],
    });
    expect(outcome._unsafeUnwrap()).toEqual({
      updatedLotIds: [draft.scheduled.id],
      skipped: [{ lotId: draft.opensMidReset.id, reason: "not_editable" }],
    });
    expect((await lotRepo.findById(draft.opensMidReset.id))?.buyerPremiumRate).toBe("0.2500");
    expect((await lotRepo.findById(draft.scheduled.id))?.buyerPremiumRate).toBeNull();
    // The audit entry is written in the same transaction and names only the lot that changed.
    const events = await db
      .select({ payload: domainEvent.payload })
      .from(domainEvent)
      .where(
        and(
          eq(domainEvent.aggregateId, bandedSaleId),
          eq(domainEvent.eventType, "sale.lot_premiums_reset"),
        ),
      );
    expect(events.map((e) => e.payload)).toEqual([
      {
        lot_ids: [draft.scheduled.id],
        previous_rates: { [draft.scheduled.id]: "0.2000" },
        differed_from_sale: 1,
      },
    ]);
  });
});
