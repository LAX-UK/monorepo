import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import {
  bid,
  buyerDefault,
  legalEntity,
  lot,
  lotReoffer,
  payment,
  sale,
  sellerConsent,
  watchlist,
} from "@auction/db/schema";
import {
  DrizzleBidRepository,
  DrizzleLotRepository,
  DrizzlePublicLotResultReader,
  DrizzleWatchlistRepository,
} from "@auction/persistence/repositories";
import type { Sale } from "@auction/types";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  deleteIdentityUserFixtures,
  seedIdentityUserFixtures,
} from "../testing/identity-user-fixtures.js";
import { DashboardQueryService } from "./dashboard-query.service.js";
import { SaleListReadService } from "./sale-list-read.service.js";
import { UserDashboardReadService } from "./user-dashboard-read.service.js";
import { WatchlistService } from "./watchlist.service.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

/**
 * The sale list, the watchlist and My bids, on the real result predicate, for a lot whose winner
 * did not pay: before the next bidder is re-awarded it, and after, while they have not paid.
 */
describe.skipIf(!HAS_DB)("open lot results on signed-in and sale list reads (integration)", () => {
  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);
  const tag = randomUUID().slice(0, 8);
  const users = {
    seller: `plr-seller-${tag}`,
    defaulter: `plr-defaulter-${tag}`,
    next: `plr-next-${tag}`,
    loser: `plr-loser-${tag}`,
    watcher: `plr-watcher-${tag}`,
  };
  const entities = {
    seller: randomUUID(),
    defaulter: randomUUID(),
    next: randomUUID(),
    loser: randomUUID(),
  };
  const saleId = randomUUID();
  const lots = { beforeReaward: randomUUID(), reawardedUnpaid: randomUUID() };
  const closed = new Date("2026-10-10T10:00:00Z");

  const lotRepo = new DrizzleLotRepository(db);
  const reader = new DrizzlePublicLotResultReader(db);
  const saleRow = {
    id: saleId,
    title: `Results ${tag}`,
    status: "ended",
    coverImages: [],
  } as unknown as Sale;
  const saleLookup = { findByIds: async () => [saleRow] };
  const dashboard = new UserDashboardReadService(
    new DashboardQueryService({
      root: { bid: new DrizzleBidRepository(db), lot: lotRepo },
    } as never),
    new WatchlistService(new DrizzleWatchlistRepository(db), lotRepo, {} as never, {} as never),
    undefined,
    saleLookup,
    undefined,
    undefined,
    reader,
  );
  const saleList = new SaleListReadService(
    { list: async () => [saleRow] } as never,
    lotRepo,
    { resolveManyUnique: async () => new Map() } as never,
    {
      lookupByKeys: async () => new Map(),
      buildGalleryImages: async () => [],
      buildGalleryImagesWithLookup: async () => [],
    } as never,
    null,
    null,
    reader,
  );

  async function defaultedLot(lotId: string, lotNumber: number, reawarded: boolean) {
    await db.insert(lot).values({
      id: lotId,
      saleId,
      lotNumber,
      title: `Result ${lotNumber} ${tag}`,
      images: [],
      auctionType: "english",
      startingPrice: "100.00",
      // Recording the default keeps the defaulter's hammer; the re-award writes the offer price.
      currentPrice: reawarded ? "900.00" : "1000.00",
      minBidIncrement: "10.00",
      startTime: new Date("2026-10-01T10:00:00Z"),
      endTime: closed,
      status: "ended",
      sellerLegalEntityId: entities.seller,
      winnerId: reawarded ? users.next : null,
      buyerLegalEntityId: reawarded ? entities.next : null,
    });
    const [nextBid] = await db
      .insert(bid)
      .values([
        { lotId, bidderId: users.next, buyerLegalEntityId: entities.next, amount: "900.00" },
        { lotId, bidderId: users.loser, buyerLegalEntityId: entities.loser, amount: "800.00" },
      ])
      .returning({ id: bid.id });
    const [def] = await db
      .insert(buyerDefault)
      .values({
        lotId,
        buyerId: users.defaulter,
        buyerLegalEntityId: entities.defaulter,
        sellerLegalEntityId: entities.seller,
        hammerPrice: "1000.00",
        wonAt: closed,
        reason: "No payment",
        outcome: "offered_to_underbidder",
      })
      .returning({ id: buyerDefault.id });
    await db.insert(watchlist).values([
      { userId: users.watcher, lotId },
      { userId: users.next, lotId },
    ]);
    if (!reawarded) return;
    const [consent] = await db
      .insert(sellerConsent)
      .values({
        subjectType: "lot_reoffer",
        subjectId: randomUUID(),
        sellerLegalEntityId: entities.seller,
        lotId,
        termsSnapshot: {},
        status: "not_needed",
        channel: "house_stock",
      })
      .returning({ id: sellerConsent.id });
    const now = new Date();
    await db.insert(lotReoffer).values({
      lotId,
      buyerDefaultId: def?.id as string,
      sequence: 1,
      offeredUserId: users.next,
      offeredLegalEntityId: entities.next,
      sourceBidId: nextBid?.id as string,
      amountPence: 90_000,
      status: "accepted",
      sellerConsentId: consent?.id as string,
      respondedAt: now,
      reawardedAt: now,
    });
    // The new buyer has started paying but the payment has not been captured.
    await db.insert(payment).values({
      lotId,
      buyerId: users.next,
      buyerLegalEntityId: entities.next,
      sellerLegalEntityId: entities.seller,
      amount: "1125.00",
      platformFee: "0.00",
      status: "pending",
    });
  }

  beforeAll(async () => {
    const now = new Date();
    await seedIdentityUserFixtures(
      db,
      Object.entries(users).map(([key, id]) => ({
        id,
        name: key,
        email: `${id}@integration.test`,
      })),
    );
    for (const key of ["seller", "defaulter", "next", "loser"] as const) {
      await db.insert(legalEntity).values({
        id: entities[key],
        displayName: key,
        kind: "individual",
        subkind: "private_collector",
        createdByUserId: users[key],
        status: "approved",
        createdAt: now,
        updatedAt: now,
      });
    }
    await db.insert(sale).values({
      id: saleId,
      title: `Results ${tag}`,
      status: "ended",
      startTime: new Date(closed.getTime() - 86_400_000),
      endTime: closed,
      createdByLegalEntityId: entities.seller,
    });
    await defaultedLot(lots.beforeReaward, 1, false);
    await defaultedLot(lots.reawardedUnpaid, 2, true);
  });

  afterAll(async () => {
    const lotIds = Object.values(lots);
    await db.delete(watchlist).where(inArray(watchlist.lotId, lotIds));
    await db.delete(payment).where(inArray(payment.lotId, lotIds));
    await db.delete(lot).where(inArray(lot.id, lotIds));
    await db.delete(sale).where(eq(sale.id, saleId));
    await db.delete(legalEntity).where(inArray(legalEntity.id, Object.values(entities)));
    await deleteIdentityUserFixtures(db, Object.values(users));
  });

  const ended = {
    currentPrice: "100.00",
    winnerId: null,
    buyerLegalEntityId: null,
    resultPending: true,
  };

  it("GET /sales previews both lots as ended, with no buyer and no price", async () => {
    const { data } = await saleList.listForPublicApi({ limit: 20, offset: 0 });
    const previews = data.find((row) => row.sale.id === saleId)?.previewLots ?? [];
    expect(previews.map((p) => p.id)).toEqual([lots.beforeReaward, lots.reawardedUnpaid]);
    for (const preview of previews) {
      expect(preview).toMatchObject({
        currentPrice: "100.00",
        hasWinner: false,
        resultPending: true,
      });
      expect(preview.checkoutPricing).toBeUndefined();
    }
  });

  it("GET /users/me/watchlist shows a watcher both lots as ended", async () => {
    const rows = await dashboard.listWatchlistForUser(users.watcher);
    const byId = new Map(rows.map((row) => [row.lotId, row.lot]));
    for (const lotId of Object.values(lots)) {
      expect(byId.get(lotId)).toMatchObject(ended);
      expect(byId.get(lotId)?.checkoutPricing).toBeUndefined();
    }
  });

  it("GET /users/me/watchlist shows the new buyer their own lot at the offer price", async () => {
    const rows = await dashboard.listWatchlistForUser(users.next);
    const byId = new Map(rows.map((row) => [row.lotId, row.lot]));
    expect(byId.get(lots.reawardedUnpaid)).toMatchObject({
      currentPrice: "900.00",
      winnerId: users.next,
      buyerLegalEntityId: entities.next,
    });
    expect(byId.get(lots.reawardedUnpaid)?.resultPending).toBeUndefined();
    expect(byId.get(lots.reawardedUnpaid)?.checkoutPricing?.hammerMajor).toBe("900.00");
    // Before it is re-awarded to them, the lot is not theirs and reads as ended.
    expect(byId.get(lots.beforeReaward)).toMatchObject(ended);
  });

  it("GET /users/me/bids shows a losing bidder both lots as ended", async () => {
    const rows = await dashboard.listBidsForUser(users.loser);
    expect(rows).toHaveLength(2);
    for (const row of rows) expect(row.lot).toMatchObject(ended);
  });

  it("GET /users/me/bids shows the new buyer their own lot at the offer price", async () => {
    const rows = await dashboard.listBidsForUser(users.next);
    const byId = new Map(rows.map((row) => [row.bid.lotId, row.lot]));
    expect(byId.get(lots.reawardedUnpaid)).toMatchObject({
      currentPrice: "900.00",
      winnerId: users.next,
    });
    expect(byId.get(lots.beforeReaward)).toMatchObject(ended);
  });
});
