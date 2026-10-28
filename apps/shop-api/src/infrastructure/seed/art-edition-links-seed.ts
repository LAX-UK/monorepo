import type { Database } from "@auction/db";
import { shopArtwork } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import type { ImportArtworkHandler } from "../../application/handlers/import-artwork.handler.js";
import {
  type GrantSaleAuthorityFn,
  depleteEditionStockForSlug,
  grantSeedAuthorityForArtwork,
} from "./edition-stock-seed.js";

/** The lax.art original whose LAX Shop editions the fixture links to. */
const ORIGINAL_SLUG = "harbour-light";

type EditionFixture = {
  slug: string;
  title: string;
  size: string;
  printPricePence: number;
  soldOut: boolean;
};

/** One edition on sale and one sold out, so both states of the cross-link render on test. */
const EDITIONS: readonly EditionFixture[] = [
  {
    slug: "harbour-light-edition",
    title: "Harbour Light, edition",
    size: "40 × 40 cm",
    printPricePence: 18_000,
    soldOut: false,
  },
  {
    slug: "harbour-light-edition-large",
    title: "Harbour Light, large edition",
    size: "70 × 70 cm",
    printPricePence: 32_000,
    soldOut: true,
  },
];

/**
 * Seeds Shop editions made from a lax.art original, so "Editions available in LAX Shop" and
 * "Editions by the artist" have data on test. Run after the originals exist; idempotent.
 */
export async function seedEditionsOfArtOriginals(
  importArtwork: ImportArtworkHandler,
  db: Database,
  grantSaleAuthority?: GrantSaleAuthorityFn,
): Promise<void> {
  const [original] = await db
    .select({ id: shopArtwork.id })
    .from(shopArtwork)
    .where(eq(shopArtwork.slug, ORIGINAL_SLUG))
    .limit(1);
  if (!original) return;
  for (const edition of EDITIONS) {
    const { artworkId } = await importArtwork({
      importKey: `seed:shop:art-edition:${edition.slug}`,
      publishOnCreate: true,
      slug: edition.slug,
      title: edition.title,
      description: "A limited edition print made from the original, signed and numbered.",
      primaryImageUrl: "/shop/home/original-3.webp",
      dimensions: edition.size,
      medium: "Giclée print on archival paper",
      yearCreated: 2024,
      saleState: "for_sale",
      artistSlug: "art-foundation-artist",
      artistDisplayName: "Mara Ellison",
      artistDiscipline: "Painter",
      eligibleForEditionAllocation: true,
      printPricePence: edition.printPricePence,
      objectType: "print",
      rarity: "limited_edition",
    });
    await db
      .update(shopArtwork)
      .set({ sourceOriginalArtworkId: original.id })
      .where(eq(shopArtwork.id, artworkId));
    if (grantSaleAuthority) await grantSeedAuthorityForArtwork(db, grantSaleAuthority, artworkId);
    if (edition.soldOut) await depleteEditionStockForSlug(db, edition.slug);
  }
}
