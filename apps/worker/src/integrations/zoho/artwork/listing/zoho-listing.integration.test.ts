import { randomUUID } from "node:crypto";
import { ArtworkOfferLock } from "@auction/artwork-register-contracts";
import { createDb } from "@auction/db";
import { legalEntity, lot, sale, user } from "@auction/db/schema";
import {
  DrizzleArtworkRegisterRepository,
  DrizzleZohoListingLock,
  DrizzleZohoListingSourceReader,
} from "@auction/persistence/repositories";
import { eq, sql } from "drizzle-orm";
import type { Logger } from "pino";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { ZohoProductState } from "../writeback-mapping.js";
import {
  OFFER_CHANGED_EVENT,
  ZohoArtworkWritebackService,
} from "../zoho-artwork-writeback-service.js";
import type { ZohoProductWriter } from "../zoho-product-writer.js";
import { ListingLinks } from "./listing-links.js";
import type { ZohoListingState } from "./zoho-listing-fields.js";
import type { ZohoListingProducts } from "./zoho-listing-products.js";
import { ZohoListingSaleStartPass } from "./zoho-listing-sale-start.js";
import { ZohoListingSync } from "./zoho-listing-sync.js";
import { ZohoListingWriteback } from "./zoho-listing-writeback.js";

const url = process.env.DATABASE_URL;

/** One Zoho Product held in memory: the Status writeback and the listing both write to it. */
function fakeZohoProduct(id: string) {
  const fields: Record<string, string | null> = { Status: "Available" };
  const counter = { writes: 0 };
  const statusWriter: ZohoProductWriter = {
    async read(productId): Promise<ZohoProductState | null> {
      if (productId !== id) return null;
      return { status: fields.Status ?? null, stockCode: fields.Reference_Stock_Code ?? null };
    },
    async update(_productId, values) {
      counter.writes += 1;
      Object.assign(fields, values);
    },
  };
  const listingProducts: ZohoListingProducts = {
    async read(productIds) {
      const state: ZohoListingState = {
        value: fields.LAX_Listing ?? null,
        detail: fields.LAX_Listing_Detail ?? null,
        link: fields.LAX_Listing_Link ?? null,
        updatedAt: fields.LAX_Listing_Updated ? new Date(fields.LAX_Listing_Updated) : null,
      };
      return new Map(productIds.includes(id) ? [[id, state]] : []);
    },
    async update(updates) {
      counter.writes += 1;
      for (const update of updates) Object.assign(fields, update.fields);
      return updates.map((update) => ({ productId: update.productId, ok: true as const }));
    },
  };
  return { fields, counter, statusWriter, listingProducts };
}

describe.skipIf(!url)("LAX listing on Zoho (Postgres)", { timeout: 30_000 }, () => {
  // biome-ignore lint/style/noNonNullAssertion: gated by url
  const db = createDb(url!);
  const register = new DrizzleArtworkRegisterRepository(db);
  const sources = new DrizzleZohoListingSourceReader(db);
  const suffix = randomUUID().slice(0, 8);
  const productId = `listing-it-${suffix}`;
  const zoho = fakeZohoProduct(productId);
  const userId = `listing-it-${suffix}`;
  const sellerId = randomUUID();
  const saleId = randomUUID();
  const lotId = randomUUID();
  let registerId = "";
  let clock = new Date("2026-11-05T09:00:00Z");
  const now = () => clock;
  const tick = () => {
    clock = new Date(clock.getTime() + 60_000);
  };
  const log = { info: vi.fn(), warn: vi.fn() } as unknown as Logger;

  const listingSync = new ZohoListingSync({
    mode: "live",
    sources,
    laxArt: { find: async () => [] },
    products: zoho.listingProducts,
    lock: new DrizzleZohoListingLock(db),
    links: new ListingLinks({
      artPublicUrl: "https://lax.art",
      laxAdminUrl: "https://admin.lax.art",
      bidPublicUrl: "https://lax.bid",
    }),
    log,
    now,
  });
  const listing = new ZohoListingWriteback({ sync: listingSync, sources, mode: "live" });
  const saleStartPass = new ZohoListingSaleStartPass({
    sync: listingSync,
    sources,
    log,
    now,
  });
  const status = new ZohoArtworkWritebackService({
    mode: "live",
    products: zoho.statusWriter,
    register,
    log,
    now,
  });
  const lock = new ArtworkOfferLock(register, now);
  const offerChanged = () => ({
    eventType: OFFER_CHANGED_EVENT,
    aggregateId: registerId,
    payload: { registerId },
  });

  beforeAll(async () => {
    const created = await register.create(
      {
        zohoProductId: productId,
        stockCode: `LAX-ORI-AR-PC-26-${String(Math.floor(Math.random() * 9000) + 1000)}`,
        kind: "original",
        sourceOriginalId: null,
        title: "Harbour at dusk",
        artist: { zohoArtistId: null, name: "Ada Rowe", code: "AR" },
        medium: null,
        dimensions: null,
        year: 2026,
        imageRefs: [],
        catalogueStatus: "Available",
      },
      "zoho",
      clock,
    );
    if (!created.ok) throw new Error(created.reason);
    registerId = created.entry.id;

    await db.insert(user).values({
      id: userId,
      name: "Seller",
      email: `${userId}@integration.test`,
      emailVerified: true,
      createdAt: clock,
      updatedAt: clock,
    });
    await db.insert(legalEntity).values({
      id: sellerId,
      displayName: "Seller",
      kind: "individual",
      subkind: "private_collector",
      createdByUserId: userId,
      status: "approved",
    });
    await db.insert(sale).values({
      id: saleId,
      title: "Autumn Modern",
      createdByLegalEntityId: sellerId,
      status: "scheduled",
      startTime: new Date("2026-11-12T18:00:00Z"),
      endTime: new Date("2026-11-14T20:00:00Z"),
    });
    await db.insert(lot).values({
      id: lotId,
      saleId,
      lotNumber: 12,
      artworkRegisterId: registerId,
      title: "Harbour at dusk",
      images: [],
      auctionType: "english",
      startingPrice: "100.00",
      currentPrice: "100.00",
      startTime: new Date("2026-11-12T18:00:00Z"),
      endTime: new Date("2026-11-14T20:00:00Z"),
      sellerLegalEntityId: sellerId,
      status: "scheduled",
    });
  });

  afterAll(async () => {
    await db.delete(lot).where(eq(lot.id, lotId));
    await db.delete(sale).where(eq(sale.id, saleId));
    await db.delete(legalEntity).where(eq(legalEntity.id, sellerId));
    await db.delete(user).where(eq(user.id, userId));
    await db.execute(sql`DELETE FROM domain_events WHERE aggregate_id = ${registerId}`);
  });

  it("shows an upcoming Bid sale once the artwork is offered in it", async () => {
    tick();
    await lock.offer({ registerId }, { kind: "bid_lot", id: lotId }, "staff:u1");
    expect(await listing.deliver(offerChanged())).toMatchObject({ outcome: "success" });
    expect(zoho.fields).toMatchObject({
      LAX_Listing: "In a LAX Bid sale — upcoming",
      LAX_Listing_Detail: "Autumn Modern · Lot 12 · starts 12 Nov 2026, 18:00",
      LAX_Listing_Link: `https://lax.bid/lot/harbour-at-dusk/${lotId}`,
    });
  });

  it("finds the sale's artwork only in the window its start time falls in", async () => {
    const start = new Date("2026-11-12T18:00:00Z");
    const find = (from: Date, to: Date) =>
      sources.registerIdsForSalesStartedBetween({ from, to }, null, 200);
    const before = new Date(start.getTime() - 1);
    expect(await find(new Date(start.getTime() - 60_000), before)).not.toContain(registerId);
    expect(await find(new Date(start.getTime() - 60_000), start)).toContain(registerId);
    expect(await find(start, new Date(start.getTime() + 60_000))).not.toContain(registerId);
  });

  it("the sale-start pass shows live now when a scheduled sale starts on its own time", async () => {
    clock = new Date("2026-11-12T18:05:00Z");
    await saleStartPass.run();
    expect(zoho.fields.LAX_Listing).toBe("In a LAX Bid sale — live now");
    const before = zoho.counter.writes;
    await saleStartPass.run();
    expect(zoho.counter.writes).toBe(before);
  });

  it("stays live now when a lot of the sale then goes on the block", async () => {
    tick();
    await db.update(lot).set({ status: "active" }).where(eq(lot.id, lotId));
    const result = await listing.deliver({
      eventType: "lot.activated",
      aggregateId: lotId,
      payload: { saleId, activatedAt: clock.toISOString() },
    });
    expect(result).toEqual({ outcome: "skipped", reason: "listing_already_in_sync" });
    expect(zoho.fields.LAX_Listing).toBe("In a LAX Bid sale — live now");
  });

  it("sends nothing when the same event is delivered again", async () => {
    const before = zoho.counter.writes;
    const again = await listing.deliver({
      eventType: "lot.activated",
      aggregateId: lotId,
      payload: { saleId },
    });
    expect(again).toEqual({ outcome: "skipped", reason: "listing_already_in_sync" });
    expect(zoho.counter.writes).toBe(before);
  });

  it("shows Sold in both the Status and the listing once the sale completes", async () => {
    tick();
    await db.update(lot).set({ status: "ended" }).where(eq(lot.id, lotId));
    await lock.markSold({ registerId }, { kind: "bid_lot", id: lotId }, "system");
    await status.deliver(offerChanged());
    await listing.deliver(offerChanged());
    expect(zoho.fields).toMatchObject({
      Status: "Sold",
      LAX_Listing: "Sold in LAX Bid",
      LAX_Listing_Detail: "Autumn Modern · Lot 12 · sold 12 Nov 2026",
    });
  });
});
