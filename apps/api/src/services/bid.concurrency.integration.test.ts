import { createDb } from "@auction/db";
import { bid, legalEntity, legalEntityMember, lot, user } from "@auction/db/schema";
import { count, eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { DrizzleRepositoryFactory } from "../repositories/drizzle-repository.factory.js";
import { LotStrategyFactory } from "../strategies/strategy.factory.js";
import { BidService } from "./bid.service.js";
import { NotificationService } from "./notification.service.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("BidService.placeBid concurrency (integration)", () => {
  const sellerUserId = "p22_seller_u";
  const buyer1UserId = "p22_buyer1_u";
  const buyer2UserId = "p22_buyer2_u";
  const sellerLeId = "33333333-3333-4333-8333-333333333333";
  const buyer1LeId = "44444444-4444-4444-8444-444444444441";
  const buyer2LeId = "44444444-4444-4444-8444-444444444442";
  const lotId = "55555555-5555-4555-8555-555555555555";

  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);
  const repos = new DrizzleRepositoryFactory(db);
  const service = new BidService({
    repos,
    strategyFactory: new LotStrategyFactory(),
    cache: { set: async () => {}, get: async () => null, del: async () => {} },
    notifications: new NotificationService(
      { notifyBidPlaced: async () => {} },
      {
        notifyLotExtended: async () => {},
        notifyLotEnded: async () => {},
        notifyProxyCancelled: async () => {},
      },
    ),
    lotJobs: null,
  });

  afterAll(async () => {
    await db.delete(bid).where(eq(bid.lotId, lotId));
    await db.delete(lot).where(eq(lot.id, lotId));
    await db
      .delete(legalEntityMember)
      .where(
        sql`${legalEntityMember.legalEntityId} IN (${sellerLeId}::uuid, ${buyer1LeId}::uuid, ${buyer2LeId}::uuid)`,
      );
    await db
      .delete(legalEntity)
      .where(
        sql`${legalEntity.id} IN (${sellerLeId}::uuid, ${buyer1LeId}::uuid, ${buyer2LeId}::uuid)`,
      );
    await db
      .delete(user)
      .where(sql`${user.id} IN (${sellerUserId}, ${buyer1UserId}, ${buyer2UserId})`);
  });

  async function waitForBidCount(minCount: number): Promise<void> {
    for (let attempt = 0; attempt < 50; attempt++) {
      const rows = await db.select({ value: count() }).from(bid).where(eq(bid.lotId, lotId));
      const value = rows[0]?.value ?? 0;
      if (Number(value) >= minCount) return;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error(`Timed out waiting for ${minCount} bid(s) on lot ${lotId}`);
  }

  it("serializes overlapping placeBid calls with a single winner and correct final price", async () => {
    const t = new Date();
    await db.insert(user).values([
      {
        id: sellerUserId,
        name: "Seller",
        email: "p22_seller_u@integration.test",
        emailVerified: true,
        createdAt: t,
        updatedAt: t,
      },
      {
        id: buyer1UserId,
        name: "Buyer 1",
        email: "p22_buyer1_u@integration.test",
        emailVerified: true,
        createdAt: t,
        updatedAt: t,
      },
      {
        id: buyer2UserId,
        name: "Buyer 2",
        email: "p22_buyer2_u@integration.test",
        emailVerified: true,
        createdAt: t,
        updatedAt: t,
      },
    ]);

    await db.insert(legalEntity).values([
      {
        id: sellerLeId,
        displayName: "Seller Gallery",
        kind: "organisation",
        subkind: "gallery",
        createdByUserId: sellerUserId,
        status: "approved",
        createdAt: t,
        updatedAt: t,
      },
      {
        id: buyer1LeId,
        displayName: "Buyer 1",
        kind: "individual",
        subkind: "private_collector",
        createdByUserId: buyer1UserId,
        status: "approved",
        createdAt: t,
        updatedAt: t,
      },
      {
        id: buyer2LeId,
        displayName: "Buyer 2",
        kind: "individual",
        subkind: "private_collector",
        createdByUserId: buyer2UserId,
        status: "approved",
        createdAt: t,
        updatedAt: t,
      },
    ]);

    await db.insert(legalEntityMember).values([
      {
        legalEntityId: sellerLeId,
        userId: sellerUserId,
        role: "owner",
        isPrimaryAdmin: true,
        acceptedAt: t,
        createdAt: t,
      },
      {
        legalEntityId: buyer1LeId,
        userId: buyer1UserId,
        role: "owner",
        isPrimaryAdmin: true,
        acceptedAt: t,
        createdAt: t,
      },
      {
        legalEntityId: buyer2LeId,
        userId: buyer2UserId,
        role: "owner",
        isPrimaryAdmin: true,
        acceptedAt: t,
        createdAt: t,
      },
    ]);

    await db.insert(lot).values({
      id: lotId,
      sellerLegalEntityId: sellerLeId,
      title: "P22 concurrency lot",
      images: [],
      auctionType: "english",
      startingPrice: "100.00",
      currentPrice: "100.00",
      minBidIncrement: "10.00",
      startTime: new Date(t.getTime() - 86_400_000),
      endTime: new Date(t.getTime() + 86_400_000),
      status: "active",
      createdAt: t,
      updatedAt: t,
    });

    const [firstResult, secondResult] = await Promise.all([
      service.placeBid({
        placedByUserId: buyer1UserId,
        buyerLegalEntityId: buyer1LeId,
        lotId,
        amount: 110,
      }),
      (async () => {
        await waitForBidCount(1);
        return service.placeBid({
          placedByUserId: buyer2UserId,
          buyerLegalEntityId: buyer2LeId,
          lotId,
          amount: 120,
        });
      })(),
    ]);

    expect(firstResult.isOk()).toBe(true);
    expect(secondResult.isOk()).toBe(true);

    const winningRows = await db
      .select({ winningCount: count() })
      .from(bid)
      .where(sql`${bid.lotId} = ${lotId}::uuid AND ${bid.isWinning} = true`);
    expect(Number(winningRows[0]?.winningCount ?? 0)).toBe(1);

    const totalRows = await db.select({ totalBids: count() }).from(bid).where(eq(bid.lotId, lotId));
    expect(Number(totalRows[0]?.totalBids ?? 0)).toBe(2);

    const [lotRow] = await db.select().from(lot).where(eq(lot.id, lotId));
    expect(lotRow?.currentPrice).toBe("120.00");
  });
});
