import type { ImportArtworkHandler } from "../../application/handlers/import-artwork.handler.js";

export const SHOP_SEED_IMPORT_KEYS = {
  eligible: "seed:shop:foundation:eligible-artwork",
  ineligible: "seed:shop:foundation:ineligible-artwork",
  secondEligible: "seed:shop:foundation:second-eligible-artwork",
} as const;

export async function seedShopFoundationCatalogue(
  importArtwork: ImportArtworkHandler,
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
    importKey: SHOP_SEED_IMPORT_KEYS.secondEligible,
    slug: "reed-study",
    title: "Reed Study",
    description: "A rhythmic study of panpipes and angular fields of colour.",
    primaryImageUrl: "/shop/home/original-3.webp",
    dimensions: "120 × 90 cm",
    yearCreated: 2014,
    saleState: "sold",
    artistSlug: "foundation-artist",
    artistDisplayName: "Flora Powers",
    artistDiscipline: "Contemporary painter",
    eligibleForEditionAllocation: true,
    printPricePence: 9_500,
  });
}
