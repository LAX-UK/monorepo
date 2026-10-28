import type { Database } from "@auction/db";
import { shopArtwork } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import type { ImportArtworkHandler } from "../../application/handlers/import-artwork.handler.js";
import { seedEditionsOfArtOriginals } from "./art-edition-links-seed.js";
import { seedArtChannelOriginals } from "./art-originals-seed.js";
import type { GrantSaleAuthorityFn } from "./edition-stock-seed.js";
import { depleteEditionStockForSlug, grantSeedAuthorityForArtwork } from "./edition-stock-seed.js";

export const SHOP_SEED_IMPORT_KEYS = {
  eligible: "seed:shop:foundation:eligible-artwork",
  ineligible: "seed:shop:foundation:ineligible-artwork",
  secondEligible: "seed:shop:foundation:second-eligible-artwork",
  buyerFixture: "seed:shop:foundation:buyer-fixture-artwork",
} as const;

/** Slug with sellable print editions after foundation seed (not depleted). */
export const SHOP_SEED_BUYER_FIXTURE_SLUG = "harbor-print";

/** Dedicated Stripe checkout acceptance fixture (reset between staging runs). */
export const SHOP_SEED_STRIPE_CHECKOUT_SLUG = "acceptance-stripe-print";

export { ART_SEED_ORIGINAL_SLUGS } from "./art-originals-seed.js";

export async function seedShopFoundationCatalogue(
  importArtwork: ImportArtworkHandler,
  db?: Database,
  grantSaleAuthority?: GrantSaleAuthorityFn,
): Promise<void> {
  await importArtwork({
    importKey: SHOP_SEED_IMPORT_KEYS.eligible,
    publishOnCreate: true,
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
    publishOnCreate: true,
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
    publishOnCreate: true,
    slug: SHOP_SEED_BUYER_FIXTURE_SLUG,
    title: "Harbor Print",
    description: "Boats at rest in a grey harbour, built up in quick, layered strokes.",
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
    importKey: "seed:shop:foundation:stripe-checkout-artwork",
    publishOnCreate: true,
    slug: SHOP_SEED_STRIPE_CHECKOUT_SLUG,
    title: "Tide Line",
    description: "The edge of a falling tide, drawn as a single unbroken line across wet sand.",
    primaryImageUrl: "/shop/home/artwork-warm-basket.webp",
    dimensions: "50 × 40 cm",
    yearCreated: 2018,
    saleState: "for_sale",
    artistSlug: "foundation-artist",
    artistDisplayName: "Flora Powers",
    artistDiscipline: "Contemporary painter",
    eligibleForEditionAllocation: true,
    printPricePence: 4_200,
  });
  await importArtwork({
    importKey: SHOP_SEED_IMPORT_KEYS.secondEligible,
    publishOnCreate: true,
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
  if (db && grantSaleAuthority) {
    for (const slug of [
      "vessel-study",
      SHOP_SEED_BUYER_FIXTURE_SLUG,
      SHOP_SEED_STRIPE_CHECKOUT_SLUG,
      "reed-study",
    ]) {
      const row = await db
        .select({ id: shopArtwork.id })
        .from(shopArtwork)
        .where(eq(shopArtwork.slug, slug))
        .limit(1);
      if (row[0]) {
        await grantSeedAuthorityForArtwork(db, grantSaleAuthority, row[0].id);
      }
    }
    await depleteEditionStockForSlug(db, "reed-study");
  }
  if (db) {
    await seedArtChannelOriginals(importArtwork, db);
    await seedEditionsOfArtOriginals(importArtwork, db, grantSaleAuthority);
  }
}
