import type { Database } from "@auction/db";
import { shopArtwork, shopArtworkCategory, shopCategory } from "@auction/db/schema";
import {
  type PlacementTarget,
  type PlannedPlacement,
  assertValidPlacementSet,
} from "@auction/shop-domain";
import { eq } from "drizzle-orm";
import type { StorefrontCurationWriter } from "../../application/ports/storefront-curation.writer.js";
import { upsertShopArtist } from "../upsert-shop-artist.js";

const publishedAt = new Date("2026-01-01T00:00:00.000Z");

async function upsertCategory(
  db: Database,
  input: { slug: string; label: string; coverImageUrl: string; sortOrder: number },
): Promise<string> {
  const existing = await db
    .select({ id: shopCategory.id })
    .from(shopCategory)
    .where(eq(shopCategory.slug, input.slug))
    .limit(1);
  if (existing[0]) {
    await db
      .update(shopCategory)
      .set({
        label: input.label,
        coverImageUrl: input.coverImageUrl,
        sortOrder: input.sortOrder,
        updatedAt: new Date(),
      })
      .where(eq(shopCategory.id, existing[0].id));
    return existing[0].id;
  }
  const [created] = await db
    .insert(shopCategory)
    .values({
      slug: input.slug,
      label: input.label,
      coverImageUrl: input.coverImageUrl,
      sortOrder: input.sortOrder,
    })
    .returning({ id: shopCategory.id });
  if (!created) {
    throw new Error(`Failed to create category ${input.slug}`);
  }
  return created.id;
}

async function artworkIdBySlug(db: Database, slug: string): Promise<string | null> {
  const [row] = await db
    .select({ id: shopArtwork.id })
    .from(shopArtwork)
    .where(eq(shopArtwork.slug, slug))
    .limit(1);
  return row?.id ?? null;
}

async function seedShopStorefrontCurationTransaction(
  db: Database,
  curationWriter: StorefrontCurationWriter,
): Promise<void> {
  const artCategoryId = await upsertCategory(db, {
    slug: "art",
    label: "Art",
    coverImageUrl: "/shop/home/category-coins.webp",
    sortOrder: 0,
  });
  const watchesCategoryId = await upsertCategory(db, {
    slug: "watches",
    label: "Watches",
    coverImageUrl: "/shop/home/category-watches.webp",
    sortOrder: 1,
  });
  const coinsCategoryId = await upsertCategory(db, {
    slug: "coins-medals",
    label: "Coins & Medals",
    coverImageUrl: "/shop/home/category-coins.webp",
    sortOrder: 2,
  });

  const emmettId = await upsertShopArtist(db, {
    slug: "emmett-king",
    displayName: "Emmett King",
    discipline: "Pop artist",
    portraitImageUrl: "/shop/home/artist-emmett.webp",
  });
  const junoId = await upsertShopArtist(db, {
    slug: "juno-frost",
    displayName: "Juno Frost",
    discipline: "Pop artist",
    portraitImageUrl: "/shop/home/artist-juno.webp",
  });
  const eliasId = await upsertShopArtist(db, {
    slug: "elias-moore",
    displayName: "Elias Moore",
    discipline: "Pop artist",
    portraitImageUrl: "/shop/home/artist-elias.webp",
  });

  const vesselId = await artworkIdBySlug(db, "vessel-study");
  const stringId = await artworkIdBySlug(db, "string-study");
  const reedId = await artworkIdBySlug(db, "reed-study");

  if (vesselId) {
    await db
      .insert(shopArtworkCategory)
      .values({ artworkId: vesselId, categoryId: artCategoryId })
      .onConflictDoNothing();
  }
  if (stringId) {
    await db
      .insert(shopArtworkCategory)
      .values({ artworkId: stringId, categoryId: artCategoryId })
      .onConflictDoNothing();
  }
  if (reedId) {
    await db
      .insert(shopArtworkCategory)
      .values({ artworkId: reedId, categoryId: coinsCategoryId })
      .onConflictDoNothing();
  }

  const placements: Array<{
    slot: "featured_originals" | "featured_categories" | "featured_prints" | "featured_artists";
    position: number;
    artworkId?: string;
    artistId?: string;
    categoryId?: string;
  }> = [];

  if (stringId) {
    placements.push({ slot: "featured_originals", position: 0, artworkId: stringId });
  }
  if (vesselId) {
    placements.push({ slot: "featured_originals", position: 1, artworkId: vesselId });
  }
  if (reedId) {
    placements.push({ slot: "featured_originals", position: 2, artworkId: reedId });
  }

  placements.push(
    { slot: "featured_categories", position: 0, categoryId: artCategoryId },
    { slot: "featured_categories", position: 1, categoryId: watchesCategoryId },
    { slot: "featured_categories", position: 2, categoryId: coinsCategoryId },
  );

  if (vesselId) {
    placements.push({ slot: "featured_prints", position: 0, artworkId: vesselId });
  }
  if (reedId) {
    placements.push({ slot: "featured_prints", position: 1, artworkId: reedId });
  }

  placements.push(
    { slot: "featured_artists", position: 0, artistId: emmettId },
    { slot: "featured_artists", position: 1, artistId: junoId },
    { slot: "featured_artists", position: 2, artistId: eliasId },
  );

  const plannedPlacements: PlannedPlacement[] = placements.map((placement) => {
    let target: PlacementTarget;
    if (placement.artworkId) {
      target = { kind: "artwork", id: placement.artworkId };
    } else if (placement.artistId) {
      target = { kind: "artist", id: placement.artistId };
    } else if (placement.categoryId) {
      target = { kind: "category", id: placement.categoryId };
    } else {
      throw new Error(`Placement ${placement.slot}:${placement.position} has no target`);
    }
    return { slot: placement.slot, position: placement.position, target };
  });
  assertValidPlacementSet(plannedPlacements);

  await curationWriter.replaceHomePlacements({
    slots: ["featured_originals", "featured_categories", "featured_prints", "featured_artists"],
    placements: plannedPlacements,
    publishedAt,
  });
}

export async function seedShopStorefrontCuration(
  db: Database,
  createCurationWriter: (database: Database) => StorefrontCurationWriter,
): Promise<void> {
  await db.transaction(async (tx) => {
    const transactionDb = tx as Database;
    await seedShopStorefrontCurationTransaction(transactionDb, createCurationWriter(transactionDb));
  });
}
