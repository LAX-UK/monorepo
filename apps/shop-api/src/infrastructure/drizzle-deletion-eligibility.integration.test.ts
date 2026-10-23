import { createDbFromPool } from "@auction/db";
import { applyApplicationRoleGrants } from "@auction/db/migrate-roles";
import {
  shopArtist,
  shopEdition,
  shopFulfilment,
  shopOrder,
  shopOriginalSale,
  shopParty,
  shopPayoutLedger,
  shopStockHold,
} from "@auction/db/schema";
import { eq } from "drizzle-orm";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDrizzleArtworkImportRepository } from "./drizzle-artwork-import.repository.js";
import { createDrizzleDeletionEligibilityRepository } from "./drizzle-deletion-eligibility.repository.js";

const ownerUrl = process.env.MIGRATION_TEST_DATABASE_URL;
const shopUrl = process.env.DATABASE_URL_SHOP;

const HOUR = 60 * 60 * 1000;

describe.skipIf(!ownerUrl || !shopUrl)("drizzle deletion eligibility repository", () => {
  let shopPool: pg.Pool;
  let ownerPool: pg.Pool;

  beforeAll(async () => {
    if (!ownerUrl || !shopUrl) throw new Error("Integration test database URLs are required");
    ownerPool = new pg.Pool({ connectionString: ownerUrl });
    shopPool = new pg.Pool({ connectionString: shopUrl });
    await applyApplicationRoleGrants(ownerUrl);
  });

  afterAll(async () => {
    await ownerPool.end();
    await shopPool.end();
  });

  const suffix = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  async function fixture() {
    const id = suffix();
    const db = createDbFromPool(shopPool);
    const subject = `deletion-subject-${id}`;
    const [party] = await db
      .insert(shopParty)
      .values({ displayName: `Collector ${id}`, identitySubjectId: subject })
      .returning({ id: shopParty.id });
    const repository = createDrizzleDeletionEligibilityRepository(db);
    let artworkCount = 0;
    /** Each open original sale needs its own artwork (one open sale per artwork). */
    const newArtwork = async () => {
      artworkCount += 1;
      const imported = await createDrizzleArtworkImportRepository(db).importArtwork({
        importKey: `integration:deletion:${id}:${artworkCount}`,
        slug: `integration-deletion-work-${id}-${artworkCount}`,
        title: "Deletion work",
        description: null,
        primaryImageUrl: null,
        artistSlug: `integration-deletion-artist-${id}`,
        artistDisplayName: "Deletion Artist",
        eligibleForEditionAllocation: false,
        printPricePence: null,
      });
      return imported.artworkId;
    };
    const order = async (
      status: (typeof shopOrder.$inferInsert)["status"],
      extra: Partial<typeof shopOrder.$inferInsert> = {},
      fulfilmentStatus?: (typeof shopFulfilment.$inferInsert)["status"],
      forSubject = subject,
    ) => {
      const [row] = await db
        .insert(shopOrder)
        .values({
          identitySubjectId: forSubject,
          status,
          fulfilment: "uk_insured_delivery",
          merchandiseSubtotalPence: 1000,
          fulfilmentSurchargePence: 0,
          totalPence: 1000,
          idempotencyKey: `deletion-${suffix()}`,
          ...extra,
        })
        .returning({ id: shopOrder.id });
      if (row && fulfilmentStatus) {
        await db
          .insert(shopFulfilment)
          .values({ orderId: row.id, option: "uk_insured_delivery", status: fulfilmentStatus });
      }
      return row?.id as string;
    };
    const originalSale = async (status: (typeof shopOriginalSale.$inferInsert)["status"]) => {
      const [row] = await db
        .insert(shopOriginalSale)
        .values({
          artworkId: await newArtwork(),
          buyerPartyId: party?.id as string,
          status,
          salePricePence: 100_000,
          recordedBySubjectId: "staff-1",
        })
        .returning({ id: shopOriginalSale.id });
      return row?.id as string;
    };
    const payout = async (
      status: (typeof shopPayoutLedger.$inferInsert)["status"],
      ownerPartyId: string | undefined = party?.id,
    ) => {
      const saleId = await originalSale("assigned");
      await db.insert(shopPayoutLedger).values({
        originalSaleId: saleId,
        source: "original_sale",
        ownerPartyId: ownerPartyId as string,
        grossPence: 1000,
        netPence: 900,
        payoutDueAt: new Date(Date.now() + HOUR),
        status,
      });
    };
    return {
      db,
      id,
      subject,
      party: party?.id as string,
      repository,
      order,
      originalSale,
      payout,
      newArtwork,
    };
  }

  it("reports nothing for a person with nothing in flight", async () => {
    const { repository, subject } = await fixture();
    expect(await repository.readOpenItems(subject)).toEqual({
      openOrders: 0,
      pendingPayouts: 0,
      openOriginalSales: 0,
      activeHolds: 0,
    });
  });

  it("reports nothing for a person Shop has never heard of", async () => {
    const { repository } = await fixture();
    expect(await repository.readOpenItems(`unknown-${suffix()}`)).toEqual({
      openOrders: 0,
      pendingPayouts: 0,
      openOriginalSales: 0,
      activeHolds: 0,
    });
  });

  describe("orders", () => {
    it("counts an order awaiting payment while its checkout is open", async () => {
      const { repository, subject, order } = await fixture();
      await order("pending_payment", { checkoutExpiresAt: new Date(Date.now() + HOUR) });
      await order("pending_payment");
      expect((await repository.readOpenItems(subject)).openOrders).toBe(2);
    });

    it("does not count an abandoned checkout whose window has passed", async () => {
      const { repository, subject, order } = await fixture();
      await order("pending_payment", { checkoutExpiresAt: new Date(Date.now() - HOUR) });
      await order("expired");
      await order("payment_failed");
      expect((await repository.readOpenItems(subject)).openOrders).toBe(0);
    });

    it.each([
      "pending_production",
      "in_production",
      "awaiting_dispatch",
      "in_transit",
      "ready_for_collection",
    ] as const)("counts a paid order whose fulfilment is %s", async (fulfilment) => {
      const { repository, subject, order } = await fixture();
      await order("paid", {}, fulfilment);
      expect((await repository.readOpenItems(subject)).openOrders).toBe(1);
    });

    it("counts a paid order that has no fulfilment yet", async () => {
      const { repository, subject, order } = await fixture();
      await order("paid");
      await order("partially_refunded");
      expect((await repository.readOpenItems(subject)).openOrders).toBe(2);
    });

    it.each(["delivered", "collected", "in_storage", "cancelled"] as const)(
      "does not count a paid order that is %s",
      async (fulfilment) => {
        const { repository, subject, order } = await fixture();
        await order("paid", {}, fulfilment);
        expect((await repository.readOpenItems(subject)).openOrders).toBe(0);
      },
    );

    it("does not count cancelled or refunded orders, or another person's orders", async () => {
      const { repository, subject, order } = await fixture();
      await order("cancelled");
      await order("refunded");
      await order("paid", {}, undefined, `someone-else-${suffix()}`);
      expect((await repository.readOpenItems(subject)).openOrders).toBe(0);
    });
  });

  describe("payouts", () => {
    it.each(["pending_refund_period", "due"] as const)("counts a %s payout", async (status) => {
      const { repository, subject, payout } = await fixture();
      await payout(status);
      expect((await repository.readOpenItems(subject)).pendingPayouts).toBe(1);
    });

    it.each(["paid", "cancelled"] as const)("does not count a %s payout", async (status) => {
      const { repository, subject, payout } = await fixture();
      await payout(status);
      expect((await repository.readOpenItems(subject)).pendingPayouts).toBe(0);
    });

    it("counts a payout owed to the artist profile linked to the person, not only their own party", async () => {
      const { db, repository, payout, id } = await fixture();
      const subject = `artist-subject-${id}`;
      const [artistParty] = await db
        .insert(shopParty)
        .values({ displayName: `Artist ${id}`, kind: "artist" })
        .returning({ id: shopParty.id });
      await db.insert(shopArtist).values({
        partyId: artistParty?.id as string,
        slug: `linked-artist-${id}`,
        identitySubjectId: subject,
      });
      await payout("due", artistParty?.id);
      expect((await repository.readOpenItems(subject)).pendingPayouts).toBe(1);
    });

    it("does not count a payout owed to someone else", async () => {
      const { db, repository, subject, payout, id } = await fixture();
      const [other] = await db
        .insert(shopParty)
        .values({ displayName: `Other ${id}`, identitySubjectId: `other-${id}` })
        .returning({ id: shopParty.id });
      await payout("due", other?.id);
      expect((await repository.readOpenItems(subject)).pendingPayouts).toBe(0);
    });
  });

  describe("original sales", () => {
    it.each(["reserved", "deposit_due", "invoiced", "paid"] as const)(
      "counts a sale that is %s",
      async (status) => {
        const { repository, subject, originalSale } = await fixture();
        await originalSale(status);
        expect((await repository.readOpenItems(subject)).openOriginalSales).toBe(1);
      },
    );

    it.each(["assigned", "cancelled"] as const)(
      "does not count a sale that is %s",
      async (status) => {
        const { repository, subject, originalSale } = await fixture();
        await originalSale(status);
        expect((await repository.readOpenItems(subject)).openOriginalSales).toBe(0);
      },
    );
  });

  describe("held works", () => {
    async function hold(
      f: Awaited<ReturnType<typeof fixture>>,
      status: (typeof shopStockHold.$inferInsert)["status"],
      expiresAt: Date,
    ) {
      const artworkId = await f.newArtwork();
      const [edition] = await f.db
        .insert(shopEdition)
        .values({ artworkId, editionNumber: 1, allocation: "lax" })
        .returning({ id: shopEdition.id });
      const [broker] = await f.db
        .insert(shopParty)
        .values({ displayName: `Broker ${f.id}`, kind: "broker" })
        .returning({ id: shopParty.id });
      await f.db.insert(shopStockHold).values({
        editionId: edition?.id as string,
        brokerPartyId: broker?.id as string,
        clientPartyId: f.party,
        status,
        expiresAt,
        createdBySubjectId: "staff-1",
      });
    }

    it("counts a hold that is active and has not expired", async () => {
      const f = await fixture();
      await hold(f, "active", new Date(Date.now() + HOUR));
      expect((await f.repository.readOpenItems(f.subject)).activeHolds).toBe(1);
    });

    it.each([
      ["released", HOUR],
      ["converted", HOUR],
      ["active", -HOUR],
    ] as const)("does not count a %s hold that expires in %i ms", async (status, offset) => {
      const f = await fixture();
      await hold(f, status, new Date(Date.now() + offset));
      expect((await f.repository.readOpenItems(f.subject)).activeHolds).toBe(0);
    });
  });

  it("clears once everything is resolved", async () => {
    const f = await fixture();
    const orderId = await f.order("pending_payment");
    expect((await f.repository.readOpenItems(f.subject)).openOrders).toBe(1);
    await f.db.update(shopOrder).set({ status: "cancelled" }).where(eq(shopOrder.id, orderId));
    expect((await f.repository.readOpenItems(f.subject)).openOrders).toBe(0);
  });
});
