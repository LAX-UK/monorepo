import { BidPlacementLimitGuard } from "@auction/bidding-runtime";
import { createDb } from "@auction/db";
import {
  bid,
  legalEntity,
  legalEntityBiddingLimit,
  legalEntityMember,
  lot,
} from "@auction/db/schema";
import { DrizzleRepositoryFactory } from "@auction/persistence/repositories";
import { inArray } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createBidAuthority, createBiddingLimitGate } from "../container/create-bid-eligibility.js";
import { LotStrategyFactory } from "../strategies/strategy.factory.js";
import {
  deleteIdentityUserFixtures,
  seedIdentityUserFixtures,
} from "../testing/identity-user-fixtures.js";
import { BidService } from "./bid.service.js";
import { NotificationFactory } from "./notification.factory.js";
import { NotificationService } from "./notification.service.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("BidService organisation bidding limit (integration)", () => {
  const sellerUserId = "orglimit_seller_u";
  const ownerUserId = "orglimit_owner_u";
  const sellerLeId = "66666666-6666-4666-8666-666666666661";
  const orgLeId = "66666666-6666-4666-8666-666666666662";
  const lotIds = ["77777777-7777-4777-8777-777777777771", "77777777-7777-4777-8777-777777777772"];

  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);
  const service = new BidService({
    repos: new DrizzleRepositoryFactory(db),
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
    notificationFactory: new NotificationFactory(),
    lotJobs: null,
    limitGuard: new BidPlacementLimitGuard(createBidAuthority(db), createBiddingLimitGate(db)),
  });

  async function cleanup(): Promise<void> {
    await db.delete(bid).where(inArray(bid.lotId, lotIds));
    await db.delete(lot).where(inArray(lot.id, lotIds));
    await db
      .delete(legalEntityBiddingLimit)
      .where(inArray(legalEntityBiddingLimit.legalEntityId, [orgLeId]));
    await db
      .delete(legalEntityMember)
      .where(inArray(legalEntityMember.legalEntityId, [sellerLeId, orgLeId]));
    await db.delete(legalEntity).where(inArray(legalEntity.id, [sellerLeId, orgLeId]));
    await deleteIdentityUserFixtures(db, [sellerUserId, ownerUserId]);
  }

  beforeEach(async () => {
    await cleanup();
    const t = new Date();
    await seedIdentityUserFixtures(db, [
      { id: sellerUserId, name: "Seller", email: `${sellerUserId}@integration.test` },
      { id: ownerUserId, name: "Owner", email: `${ownerUserId}@integration.test` },
    ]);
    await db.insert(legalEntity).values([
      {
        id: sellerLeId,
        displayName: "Seller",
        kind: "individual",
        subkind: "private_collector",
        createdByUserId: sellerUserId,
        status: "approved",
      },
      {
        id: orgLeId,
        displayName: "Northbank Gallery",
        kind: "organisation",
        subkind: "gallery",
        createdByUserId: ownerUserId,
        status: "approved",
      },
    ]);
    await db.insert(legalEntityMember).values([
      { legalEntityId: sellerLeId, userId: sellerUserId, role: "owner", acceptedAt: t },
      { legalEntityId: orgLeId, userId: ownerUserId, role: "owner", acceptedAt: t },
    ]);
    await db.insert(lot).values(
      lotIds.map((id) => ({
        id,
        sellerLegalEntityId: sellerLeId,
        title: "Organisation limit lot",
        images: [],
        auctionType: "english" as const,
        startingPrice: "100.00",
        currentPrice: "100.00",
        minBidIncrement: "10.00",
        startTime: new Date(t.getTime() - 86_400_000),
        endTime: new Date(t.getTime() + 86_400_000),
        status: "active" as const,
      })),
    );
    await db.insert(legalEntityBiddingLimit).values({
      legalEntityId: orgLeId,
      limitAmount: "1000.00",
      setByUserId: ownerUserId,
    });
  });

  afterEach(cleanup);

  const place = (lotId: string, maxAutoBidAmount: number) =>
    service.placeBid({
      placedByUserId: ownerUserId,
      buyerLegalEntityId: orgLeId,
      lotId,
      amount: 110,
      maxAutoBidAmount,
    });

  it("holds an owner to the organisation limit across lots, even when bids race", async () => {
    const [a, b] = await Promise.all([
      place(lotIds[0] as string, 600),
      place(lotIds[1] as string, 600),
    ]);

    const outcomes = [a, b].map((r) => (r.isOk() ? "placed" : r.error.code));
    expect(outcomes.sort()).toEqual(["organisation_limit_exceeded", "placed"]);
    const refused = [a, b].find((r) => r.isErr());
    expect(refused?._unsafeUnwrapErr()).toMatchObject({
      status: 403,
      details: { limitKind: "organisation", limit: "1000.00", available: "400.00" },
    });
  });

  it("allows bids that fit under the limit together", async () => {
    expect((await place(lotIds[0] as string, 600)).isOk()).toBe(true);
    expect((await place(lotIds[1] as string, 400)).isOk()).toBe(true);
  });
});
