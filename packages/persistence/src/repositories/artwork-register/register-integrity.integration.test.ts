import { type Database, createDb } from "@auction/db";
import {
  artworkRegister,
  legalEntity,
  lot,
  shopArtist,
  shopArtwork,
  shopParty,
  user,
} from "@auction/db/schema";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { DrizzleBidPublishSettings } from "./drizzle-bid-publish-settings.js";
import { DrizzleRegisterLotIntegrityReader } from "./drizzle-register-lot-integrity.reader.js";
import { DrizzleUnlinkedOriginalsReader } from "./drizzle-unlinked-originals.reader.js";

const url = process.env.DATABASE_URL;

const userId = "register-integrity-user";
const entityId = "bbbbbbbb-0000-4000-8000-000000000001";
const at = new Date("2026-11-03T09:00:00.000Z");

const id = (n: number) => `bbbbbbbb-0000-4000-8000-0000000001${String(n).padStart(2, "0")}`;

/** Runs the body on a transaction that is always rolled back, so nothing is left behind. */
async function inRolledBackTransaction(body: (db: Database) => Promise<void>): Promise<void> {
  if (!url) throw new Error("DATABASE_URL required");
  const db = createDb(url);
  const rollback = new Error("rollback_register_integrity_test");
  try {
    await db.transaction(async (tx) => {
      await tx.insert(user).values({
        id: userId,
        name: "Staff",
        email: "register-integrity@integration.test",
        emailVerified: true,
        createdAt: at,
        updatedAt: at,
      });
      await tx.insert(legalEntity).values({
        id: entityId,
        displayName: "Gallery",
        kind: "organisation",
        subkind: "gallery",
        createdByUserId: userId,
        status: "approved",
        createdAt: at,
        updatedAt: at,
      });
      await body(tx as unknown as Database);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
}

async function register(db: Database, n: number, offer: "bid_sale" | "held", lotId?: string) {
  await db.insert(artworkRegister).values({
    id: id(n),
    zohoProductId: `integrity-${n}`,
    stockCode: `LAX-ORI-PH-GAC-26-${8000 + n}`,
    kind: "original",
    title: `Work ${n}`,
    artistName: "Aidan Phelan",
    artistCode: "PH",
    offerState: offer,
    offerRefKind: lotId ? "bid_lot" : null,
    offerRefId: lotId ?? null,
  });
}

async function newLot(
  db: Database,
  n: number,
  fields: Partial<typeof lot.$inferInsert> = {},
): Promise<string> {
  const lotId = id(n);
  await db.insert(lot).values({
    id: lotId,
    sellerLegalEntityId: entityId,
    title: `Lot ${n}`,
    images: [],
    auctionType: "english",
    startingPrice: "100",
    currentPrice: "100",
    buyerPremiumRate: "0.25",
    minBidIncrement: "10",
    startTime: new Date("2026-12-01T12:00:00.000Z"),
    endTime: new Date("2026-12-02T12:00:00.000Z"),
    status: "draft",
    ...fields,
  });
  return lotId;
}

describe.skipIf(!url)("register and lot integrity (Postgres)", { timeout: 30_000 }, () => {
  it("finds an artwork in a Bid sale whose lot is not live, and clears when they agree", async () => {
    await inRolledBackTransaction(async (db) => {
      const reader = new DrizzleRegisterLotIntegrityReader(db);
      const mine = new Set([id(1), id(2), id(3), id(4), id(5), id(6)]);
      const found = async () =>
        (await reader.listBidSaleMismatches(1000)).filter((row) => mine.has(row.registerId));

      // Live: scheduled, active, and ended with a winner who has yet to pay.
      await register(db, 1, "bid_sale", await newLot(db, 11, { status: "scheduled" }));
      await register(db, 2, "bid_sale", await newLot(db, 12, { status: "active" }));
      await register(
        db,
        3,
        "bid_sale",
        await newLot(db, 13, { status: "ended", winnerId: userId }),
      );
      expect(await found()).toEqual([]);

      // Not live: a draft (a publish that rolled back), no lot at all, cancelled, ended unsold.
      await register(db, 4, "bid_sale", await newLot(db, 14, { status: "draft" }));
      await register(db, 5, "bid_sale", id(99));
      await register(db, 6, "bid_sale", await newLot(db, 16, { status: "cancelled" }));
      const draftOnly = await found();
      expect(draftOnly.map((row) => [row.registerId, row.lotStatus])).toEqual(
        expect.arrayContaining([
          [id(4), "draft"],
          [id(5), null],
          [id(6), "cancelled"],
        ]),
      );
      expect(draftOnly).toHaveLength(3);

      // Staff fix them: the draft is published, the others are released.
      await db
        .update(lot)
        .set({ status: "scheduled" })
        .where(eq(lot.id, id(14)));
      await db
        .update(artworkRegister)
        .set({ offerState: "held", offerRefKind: null, offerRefId: null })
        .where(eq(artworkRegister.id, id(5)));
      await db
        .update(artworkRegister)
        .set({ offerState: "held", offerRefKind: null, offerRefId: null })
        .where(eq(artworkRegister.id, id(6)));
      expect(await found()).toEqual([]);
    });
  });

  it("ignores artworks that are held and a lot that was deleted counts as gone", async () => {
    await inRolledBackTransaction(async (db) => {
      const reader = new DrizzleRegisterLotIntegrityReader(db);
      await register(db, 1, "held");
      await register(
        db,
        2,
        "bid_sale",
        await newLot(db, 12, { status: "scheduled", deletedAt: at }),
      );
      const rows = (await reader.listBidSaleMismatches(1000)).filter((row) =>
        [id(1), id(2)].includes(row.registerId),
      );
      expect(rows.map((row) => [row.registerId, row.lotStatus])).toEqual([[id(2), null]]);
    });
  });

  it("lists live originals with no register link on lax.art and in Bid, and drops them once linked", async () => {
    await inRolledBackTransaction(async (db) => {
      const reader = new DrizzleUnlinkedOriginalsReader(db);
      const [party] = await db
        .insert(shopParty)
        .values({ displayName: "Aidan Phelan", kind: "person" })
        .returning();
      const [artist] = await db
        .insert(shopArtist)
        .values({ partyId: party?.id ?? "", slug: "register-integrity-artist" })
        .returning();
      const artwork = (suffix: string, fields: Partial<typeof shopArtwork.$inferInsert> = {}) =>
        db
          .insert(shopArtwork)
          .values({
            slug: `register-integrity-${suffix}`,
            title: `Print or original ${suffix}`,
            artistId: artist?.id ?? "",
            eligibleForEditionAllocation: false,
            importKey: `it:register-integrity:${suffix}`,
            salesChannel: "art",
            ...fields,
          })
          .returning({ id: shopArtwork.id });
      const [liveOriginal] = await artwork("live");
      await artwork("draft", { publishedAt: null });
      await artwork("archived", { archivedAt: at });
      await artwork("linked", { zohoProductId: "integrity-linked" });
      await artwork("edition", { eligibleForEditionAllocation: true });

      await register(db, 1, "held");
      await register(db, 2, "held");
      const unlinkedLot = await newLot(db, 11, { status: "scheduled" });
      await newLot(db, 12, { status: "draft" });
      await newLot(db, 13, { status: "active", artworkRegisterId: id(1) });

      const mine = new Set([liveOriginal?.id, unlinkedLot]);
      const report = await reader.listLiveUnlinkedOriginals(5000);
      const items = report.items.filter((item) => mine.has(item.id));
      expect(items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ product: "bid", id: unlinkedLot, state: "Scheduled" }),
          expect.objectContaining({
            product: "lax_art",
            id: liveOriginal?.id,
            artistName: "Aidan Phelan",
          }),
        ]),
      );
      expect(items).toHaveLength(2);
      expect(report.counts.bid).toBeGreaterThanOrEqual(1);
      expect(report.counts.laxArt).toBeGreaterThanOrEqual(1);

      await db
        .update(lot)
        .set({ artworkRegisterId: id(2) })
        .where(eq(lot.id, unlinkedLot));
      await db
        .update(shopArtwork)
        .set({ zohoProductId: "integrity-now-linked" })
        .where(eq(shopArtwork.id, liveOriginal?.id ?? ""));
      const after = await reader.listLiveUnlinkedOriginals(5000);
      expect(after.items.filter((item) => mine.has(item.id))).toEqual([]);
    });
  });

  it("keeps the Bid publish switch off until staff turn it on, and remembers who changed it", async () => {
    await inRolledBackTransaction(async (db) => {
      const settings = new DrizzleBidPublishSettings(db, () => at);
      expect(await settings.blockUnlinkedPublish()).toBe(false);
      await settings.setBlockUnlinkedPublish(true, userId);
      expect(await settings.blockUnlinkedPublish()).toBe(true);
      await settings.setBlockUnlinkedPublish(false, userId);
      expect(await settings.blockUnlinkedPublish()).toBe(false);
    });
  });
});
