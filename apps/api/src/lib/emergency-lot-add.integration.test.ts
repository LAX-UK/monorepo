import { createDb } from "@auction/db";
import { legalEntity, lot, sale, user } from "@auction/db/schema";
import { DrizzleRepositoryFactory } from "@auction/persistence";
import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { rollbackFailedEmergencyLotAdd } from "./emergency-lot-add.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("rollbackFailedEmergencyLotAdd (integration)", () => {
  const lotId = "77777777-7777-4777-8777-777777777771";
  const saleId = "88888888-8888-4888-8888-888888888881";
  const sellerUserId = "emergency-rollback-seller";
  const sellerLeId = "99999999-9999-4999-8999-999999999991";

  it("clears saleId inside transaction and rolls back on failure", async () => {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error("DATABASE_URL required");
    const db = createDb(databaseUrl);
    const rollback = new Error("rollback_emergency_lot_add_test");

    try {
      await db.transaction(async (tx) => {
        const t = new Date();
        await tx.insert(user).values({
          id: sellerUserId,
          name: "Seller",
          email: "emergency-rollback-seller@integration.test",
          emailVerified: true,
          createdAt: t,
          updatedAt: t,
        });
        await tx.insert(legalEntity).values({
          id: sellerLeId,
          displayName: "Gallery",
          kind: "organisation",
          subkind: "gallery",
          createdByUserId: sellerUserId,
          status: "approved",
          createdAt: t,
          updatedAt: t,
        });
        await tx.insert(sale).values({
          id: saleId,
          title: "Live sale",
          status: "active",
          deliveryMode: "online",
          allowOnlineBidsBeforeGoLive: false,
          startTime: new Date("2026-07-01T12:00:00.000Z"),
          endTime: new Date("2026-07-02T12:00:00.000Z"),
          buyerPremiumRate: "0.25",
          createdByLegalEntityId: sellerLeId,
          createdAt: t,
          updatedAt: t,
        });
        await tx.insert(lot).values({
          id: lotId,
          saleId,
          lotNumber: 1,
          sellerLegalEntityId: sellerLeId,
          title: "Emergency lot",
          images: [],
          auctionType: "english",
          startingPrice: "100",
          currentPrice: "100",
          buyerPremiumRate: "0.25",
          minBidIncrement: "10",
          startTime: new Date("2026-07-01T12:00:00.000Z"),
          endTime: new Date("2026-07-02T12:00:00.000Z"),
          status: "draft",
          createdAt: t,
          updatedAt: t,
        });

        const repoFactory = new DrizzleRepositoryFactory(tx);
        const lotRow = {
          id: lotId,
          saleId,
          lotNumber: 1,
          sellerLegalEntityId: sellerLeId,
          title: "Emergency lot",
          description: null,
          medium: null,
          dimensions: null,
          images: [] as string[],
          categoryId: "cat-1",
          auctionType: "english" as const,
          startingPrice: "100",
          reservePrice: null,
          buyNowPrice: null,
          currentPrice: "100",
          buyerPremiumRate: "0.25",
          minBidIncrement: "10",
          dutchDecrementAmount: null,
          dutchDecrementIntervalMs: 0,
          dutchLastDecrementAt: null,
          startTime: new Date("2026-07-01T12:00:00.000Z"),
          endTime: new Date("2026-07-02T12:00:00.000Z"),
          status: "draft" as const,
          winnerId: null,
          createdAt: t,
          updatedAt: t,
          marketingDetails: {},
        };

        await rollbackFailedEmergencyLotAdd(lotRow, {
          lotRepo: repoFactory.root.lot,
          jobScheduler: null,
          lotLifecycleRecording: { recordDetached: vi.fn() } as never,
          transactionRunner: { runInTransaction: (fn) => fn(tx) },
          repoFactory,
        });

        const [cleared] = await tx
          .select({ saleId: lot.saleId })
          .from(lot)
          .where(eq(lot.id, lotId));
        expect(cleared?.saleId).toBeNull();

        throw rollback;
      });
    } catch (e) {
      if (e !== rollback) throw e;
    }

    const dbAfter = createDb(databaseUrl);
    const [outside] = await dbAfter
      .select({ saleId: lot.saleId })
      .from(lot)
      .where(eq(lot.id, lotId));
    expect(outside).toBeUndefined();
  });
});
