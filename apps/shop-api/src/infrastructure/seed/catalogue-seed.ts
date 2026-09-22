import type { Database } from "@auction/db";
import { shopArtwork, shopEdition } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import type { ImportArtworkHandler } from "../../application/handlers/import-artwork.handler.js";

export const SHOP_SEED_IMPORT_KEYS = {
  eligible: "seed:shop:foundation:eligible-artwork",
  ineligible: "seed:shop:foundation:ineligible-artwork",
  secondEligible: "seed:shop:foundation:second-eligible-artwork",
  buyerFixture: "seed:shop:foundation:buyer-fixture-artwork",
} as const;

/** Slug with sellable print editions after foundation seed (not depleted). */
export const SHOP_SEED_BUYER_FIXTURE_SLUG = "harbor-print";

async function depleteEditionStockForSlug(db: Database, slug: string): Promise<void> {
  const artwork = await db
    .select({ id: shopArtwork.id })
    .from(shopArtwork)
    .where(eq(shopArtwork.slug, slug))
    .limit(1);
  const artworkId = artwork[0]?.id;
  if (!artworkId) return;
  await db
    .update(shopEdition)
    .set({ status: "sold", ownerPartyId: null })
    .where(eq(shopEdition.artworkId, artworkId));
}

export async function seedShopFoundationCatalogue(
  importArtwork: ImportArtworkHandler,
  db?: Database,
): Promise<void> {
  await importArtwork({
    importKey: SHOP_SEED_IMPORT_KEYS.eligible,
    slug: "vessel-study",
    title: "Vessel Study",
    description: "An expressive still life built from a dark vessel and intersecting colour.",
    primaryImageUrl: "/shop/home/artwork-warm-basket.webp",
    dimensions: "120 × 90 cm",
    yearCreated: 2014,
    saleState: "price_on_application",
    artistSlug: "foundation-artist",
    artistDisplayName: "Flora Powers",
    artistDiscipline: "Contemporary painter",
    eligibleForEditionAllocation: true,
    printPricePence: 12_000,
  });
  await importArtwork({
    importKey: SHOP_SEED_IMPORT_KEYS.ineligible,
    slug: "string-study",
    title: "String Study",
    description: "A suspended stringed instrument set against layered, muted colour.",
    primaryImageUrl: "/shop/home/original-2.webp",
    dimensions: "120 × 90 cm",
    yearCreated: 2014,
    saleState: "price_on_application",
    artistSlug: "foundation-artist",
    artistDisplayName: "Flora Powers",
    artistDiscipline: "Contemporary painter",
    eligibleForEditionAllocation: false,
  });
  await importArtwork({
    importKey: SHOP_SEED_IMPORT_KEYS.buyerFixture,
    slug: SHOP_SEED_BUYER_FIXTURE_SLUG,
    title: "Harbor Print",
    description: "A coastal print edition kept in stock for commerce acceptance fixtures.",
    primaryImageUrl: "/shop/home/artwork-warm-basket.webp",
    dimensions: "60 × 45 cm",
    yearCreated: 2016,
    saleState: "for_sale",
    artistSlug: "foundation-artist",
    artistDisplayName: "Flora Powers",
    artistDiscipline: "Contemporary painter",
    eligibleForEditionAllocation: true,
    printPricePence: 8_500,
  });
  await importArtwork({
    importKey: SHOP_SEED_IMPORT_KEYS.secondEligible,
    slug: "reed-study",
    title: "Reed Study",
    description: "A rhythmic study of panpipes and angular fields of colour.",
    primaryImageUrl: "/shop/home/original-3.webp",
    dimensions: "120 × 90 cm",
    yearCreated: 2014,
    saleState: "for_sale",
    artistSlug: "foundation-artist",
    artistDisplayName: "Flora Powers",
    artistDiscipline: "Contemporary painter",
    eligibleForEditionAllocation: true,
    printPricePence: 9_500,
  });
  if (db) {
    await depleteEditionStockForSlug(db, "reed-study");
  }
}
