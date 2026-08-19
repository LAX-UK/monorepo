import { createDb } from "@auction/db";
import { bid, legalEntity, legalEntityMember, lot, user } from "@auction/db/schema";
import { DrizzleBidRepository } from "@auction/persistence/repositories";
import { count, eq, sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("DrizzleBidRepository.markWinningBid (integration)", () => {
  const sellerUserId = "p23_seller_u";
  const buyer1UserId = "p23_buyer1_u";
  const buyer2UserId = "p23_buyer2_u";
  const sellerLeId = "66666666-6666-4666-8666-666666666666";
  const buyer1LeId = "77777777-7777-4777-8777-777777777771";
  const buyer2LeId = "77777777-7777-4777-8777-777777777772";
  const lotId = "88888888-8888-4888-8888-888888888888";
  const firstBidId = "99999999-9999-4999-8999-999999999991";
  const secondBidId = "99999999-9999-4999-8999-999999999992";

  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);

  async function cleanupFixture(): Promise<void> {
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
  }

  beforeEach(async () => {
    await cleanupFixture();
  });

  afterEach(async () => {
    await cleanupFixture();
  });

  it("promotes a new winner without violating bid_one_winner_per_lot_uniq", async () => {
    const t = new Date();
    await db.insert(user).values([
      {
        id: sellerUserId,
        name: "Seller",
        email: "p23_seller_u@integration.test",
        emailVerified: true,
        createdAt: t,
        updatedAt: t,
      },
      {
        id: buyer1UserId,
        name: "Buyer 1",
        email: "p23_buyer1_u@integration.test",
        emailVerified: true,
        createdAt: t,
        updatedAt: t,
      },
      {
        id: buyer2UserId,
        name: "Buyer 2",
        email: "p23_buyer2_u@integration.test",
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
      title: "P23 markWinningBid lot",
      images: [],
      auctionType: "english",
      startingPrice: "100.00",
      currentPrice: "110.00",
      minBidIncrement: "10.00",
      startTime: new Date(t.getTime() - 86_400_000),
      endTime: new Date(t.getTime() + 86_400_000),
      status: "active",
      createdAt: t,
      updatedAt: t,
    });

    await db.insert(bid).values([
      {
        id: firstBidId,
        lotId,
        bidderId: buyer1UserId,
        subjectId: buyer1UserId,
        buyerLegalEntityId: buyer1LeId,
        amount: "110.00",
        isWinning: true,
        isAutoBid: false,
        createdAt: t,
      },
      {
        id: secondBidId,
        lotId,
        bidderId: buyer2UserId,
        subjectId: buyer2UserId,
        buyerLegalEntityId: buyer2LeId,
        amount: "120.00",
        isWinning: false,
        isAutoBid: false,
        createdAt: new Date(t.getTime() + 1000),
      },
    ]);

    await new DrizzleBidRepository(db).markWinningBid(lotId, secondBidId);

    const winningRows = await db
      .select({ id: bid.id, isWinning: bid.isWinning })
      .from(bid)
      .where(sql`${bid.lotId} = ${lotId}::uuid AND ${bid.isWinning} = true`);
    expect(winningRows).toHaveLength(1);
    expect(winningRows[0]?.id).toBe(secondBidId);

    const winningCount = await db
      .select({ winningCount: count() })
      .from(bid)
      .where(sql`${bid.lotId} = ${lotId}::uuid AND ${bid.isWinning} = true`);
    expect(Number(winningCount[0]?.winningCount ?? 0)).toBe(1);
  });
});
