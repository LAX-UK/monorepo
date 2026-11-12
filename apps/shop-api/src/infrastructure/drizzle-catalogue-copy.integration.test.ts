import {
  ArtworkOfferLock,
  type NewArtworkRegisterEntry,
} from "@auction/artwork-register-contracts";
import { createDbFromPool } from "@auction/db";
import { shopAdminAudit, shopArtist, shopArtwork, shopArtworkImage } from "@auction/db/schema";
import {
  DrizzleArtworkRegisterRepository,
  registerRowToEntry,
} from "@auction/persistence/repositories";
import { eq } from "drizzle-orm";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CatalogueCopyRefusedError } from "../application/ports/catalogue-change.ports.js";
import { integrationSuffix, uniqueStockCode } from "../test-support/shop-fixtures.js";
import {
  createShopDb,
  hasShopIntegrationDb,
  setupShopIntegrationPools,
} from "../test-support/shop-integration-setup.js";
import { createDrizzleArtistCatalogueWriter } from "./drizzle-artist-catalogue.writer.js";
import { createDrizzleLaxArtCatalogueCopyStore } from "./drizzle-catalogue-copy.js";
import { createDrizzleShopUnitOfWork } from "./drizzle-shop-transaction-effects.js";
import { createDrizzleZohoLinkWriter } from "./drizzle-zoho-link.js";

const ACTOR = "catalogue-copy-it-staff";
const NOW = new Date("2026-11-05T09:00:00.000Z");
const LATER = new Date("2026-11-06T09:00:00.000Z");
const key = () => `idem-${integrationSuffix("c")}`;

describe.skipIf(!hasShopIntegrationDb)("Zoho changed since it was listed (Postgres)", () => {
  let shopPool: pg.Pool;
  let ownerPool: pg.Pool;

  beforeAll(async () => {
    ({ ownerPool, shopPool } = await setupShopIntegrationPools());
  });

  afterAll(async () => {
    await shopPool.end();
    await ownerPool.end();
  });

  function setup() {
    const db = createShopDb(shopPool);
    const uow = createDrizzleShopUnitOfWork(db, "off");
    const shopRegister = new DrizzleArtworkRegisterRepository(db);
    const register = new DrizzleArtworkRegisterRepository(createDbFromPool(ownerPool));
    return {
      db,
      register,
      linker: createDrizzleZohoLinkWriter(uow, {
        registerFor: (session) => shopRegister.withExecutor(session),
        lockFor: (session) => new ArtworkOfferLock(shopRegister.withExecutor(session)),
        toEntry: registerRowToEntry,
        now: () => NOW,
      }),
      store: createDrizzleLaxArtCatalogueCopyStore(db, uow, {
        register: shopRegister,
        now: () => LATER,
      }),
      artists: createDrizzleArtistCatalogueWriter(uow),
    };
  }

  /** A listing linked to a record, as a draft or live, then Zoho renames the artwork. */
  async function linkedListing(label: string, published: boolean) {
    const { db, register, linker, artists } = setup();
    const suffix = integrationSuffix("r");
    const code = `Z${suffix.slice(-5).toUpperCase()}`;
    const created = await register.create(
      {
        zohoProductId: `zoho-${suffix}`,
        stockCode: uniqueStockCode("original"),
        kind: "original",
        sourceOriginalId: null,
        title: "Tidal margin IV",
        artist: { zohoArtistId: "77", name: "Ada Rowe", code },
        medium: "Oil on linen",
        dimensions: "90 × 120 cm",
        year: 2024,
        imageRefs: ["zoho-a.jpg"],
        catalogueStatus: "Available",
      } satisfies NewArtworkRegisterEntry,
      "zoho",
      NOW,
    );
    if (!created.ok) throw new Error(created.reason);
    const artist = await artists.createArtist({
      displayName: "Ada Rowe",
      slug: `it-catalogue-${integrationSuffix(label)}`,
      discipline: null,
      actorSubjectId: ACTOR,
      idempotencyKey: key(),
    });
    await db
      .update(shopArtist)
      .set({ zohoArtistCode: code })
      .where(eq(shopArtist.id, artist.artistId));
    const [row] = await db
      .insert(shopArtwork)
      .values({
        slug: `it-catalogue-${integrationSuffix(label)}`,
        title: "Tidal margin IV",
        artistId: artist.artistId,
        eligibleForEditionAllocation: false,
        importKey: `it:catalogue:${integrationSuffix(label)}`,
        salesChannel: "art",
        saleState: "for_sale",
        ...(published ? {} : { publishedAt: null }),
      })
      .returning();
    if (!row) throw new Error("listing");
    await db
      .insert(shopArtworkImage)
      .values({ artworkId: row.id, mediaKey: "legacy.jpg", position: 0, alt: null });
    await linker.link({ artworkId: row.id, registerId: created.entry.id, actorSubjectId: ACTOR });
    // Zoho renames the artwork after the listing took its details.
    await register.applyZohoChange(
      {
        zohoProductId: created.entry.zohoProductId,
        modifiedAt: LATER,
        fields: { title: "Tidal margin V" },
      },
      LATER,
    );
    const entry = await register.findById(created.entry.id);
    if (!entry) throw new Error("entry");
    return { listing: row, entry };
  }

  it("shows a draft listing as differing from Zoho, then updates it and records who did", async () => {
    const { store, db } = setup();
    const { listing, entry } = await linkedListing("draft", false);

    const copy = await store.read(entry.zohoProductId);
    expect(copy).toMatchObject({ artworkId: listing.id, published: false });
    expect(copy?.facts.title).toBe("Tidal margin IV");

    const result = await store.updateDraft({
      zohoProductId: entry.zohoProductId,
      entry,
      actorSubjectId: ACTOR,
    });
    expect(result.updated).toEqual(["Title"]);
    const [after] = await db.select().from(shopArtwork).where(eq(shopArtwork.id, listing.id));
    expect(after).toMatchObject({ title: "Tidal margin V", slug: listing.slug });
    const audit = await db
      .select({ action: shopAdminAudit.action })
      .from(shopAdminAudit)
      .where(eq(shopAdminAudit.targetId, listing.id));
    expect(audit.map((row) => row.action)).toContain("zoho_catalogue_update");

    // Again: nothing left to change, and nothing more is recorded.
    const again = await store.updateDraft({
      zohoProductId: entry.zohoProductId,
      entry,
      actorSubjectId: ACTOR,
    });
    expect(again.updated).toEqual([]);
  });

  it("never changes a published listing, even when asked", async () => {
    const { store, db } = setup();
    const { listing, entry } = await linkedListing("live", true);
    await expect(
      store.updateDraft({ zohoProductId: entry.zohoProductId, entry, actorSubjectId: ACTOR }),
    ).rejects.toThrow(CatalogueCopyRefusedError);
    const [after] = await db.select().from(shopArtwork).where(eq(shopArtwork.id, listing.id));
    expect(after?.title).toBe("Tidal margin IV");
    expect((await store.read(entry.zohoProductId))?.published).toBe(true);
  });
});
