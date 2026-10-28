import type { Database } from "@auction/db";
import { shopArtwork, shopEdition } from "@auction/db/schema";
import type { CustomLimitedRun } from "@auction/shop-domain";
import { and, asc, eq } from "drizzle-orm";
import { createDrizzleArtworkImportRepository } from "../drizzle-artwork-import.repository.js";
import { createDrizzleEditionFactsRepository } from "../drizzle-edition-facts.repository.js";
import { createDrizzleSaleAuthorityWriter } from "../drizzle-sale-authority.writer.js";
import { insertEditionRun } from "../insert-planned-editions.js";
import { grantSeedAuthorityForArtwork } from "./edition-stock-seed.js";

export const SHOP_ACCEPTANCE_CUSTOM_ORIGINAL_SLUG = "acceptance-tide-line-original";
export const SHOP_ACCEPTANCE_CUSTOM_RUN_SLUG = "acceptance-tide-line-print";

const ARTIST = {
  artistSlug: "acceptance-custom-run-artist",
  artistDisplayName: "Acceptance Custom Artist",
} as const;

/** 30 prints: 6 for the original's buyer, 18 for the artist, 6 for LAX. */
const RUN: CustomLimitedRun = {
  type: "custom_limited",
  size: 30,
  allocation: { buyer: 6, artist: 18, lax: 6 },
  linkedToOriginal: true,
};

/**
 * An original on lax.art with a custom run made from it, for the stock hold and original sale
 * acceptance runs: the run is live, LAX's prints are on sale, and its buyer prints wait for the
 * original's buyer. Safe to run again.
 */
export async function seedAcceptanceCustomRunFixture(db: Database): Promise<{
  originalArtworkId: string;
  runArtworkId: string;
  runSlug: string;
  holdEditionId: string;
}> {
  const imports = createDrizzleArtworkImportRepository(db, "off");
  const original = await imports.importArtwork({
    importKey: `seed:acceptance:${SHOP_ACCEPTANCE_CUSTOM_ORIGINAL_SLUG}`,
    publishOnCreate: true,
    slug: SHOP_ACCEPTANCE_CUSTOM_ORIGINAL_SLUG,
    title: "Tide line (original)",
    description: "The original the acceptance custom run is printed from.",
    primaryImageUrl: "/shop/home/artwork-warm-basket.webp",
    saleState: "price_on_application",
    salesChannel: "art",
    eligibleForEditionAllocation: false,
    ...ARTIST,
  });
  const run = await imports.importArtwork({
    importKey: `seed:acceptance:${SHOP_ACCEPTANCE_CUSTOM_RUN_SLUG}`,
    publishOnCreate: true,
    slug: SHOP_ACCEPTANCE_CUSTOM_RUN_SLUG,
    title: "Tide line",
    description: "A custom run of 30 from the Tide line original.",
    primaryImageUrl: "/shop/home/artwork-warm-basket.webp",
    saleState: "for_sale",
    eligibleForEditionAllocation: true,
    printPricePence: 18_000,
    ...ARTIST,
  });
  if (run.created) {
    const [artwork] = await db
      .update(shopArtwork)
      .set({ sourceOriginalArtworkId: original.artworkId })
      .where(eq(shopArtwork.id, run.artworkId))
      .returning({ artistId: shopArtwork.artistId });
    // The import made the LAX standard run; nothing of it has been offered yet.
    await db.delete(shopEdition).where(eq(shopEdition.artworkId, run.artworkId));
    await insertEditionRun(db, {
      artworkId: run.artworkId,
      artistId: artwork?.artistId ?? "",
      run: RUN,
    });
    await createDrizzleEditionFactsRepository(db).saveFacts(run.artworkId, {
      numbering: "on_print",
      signature: { kind: "hand_signed", medium: "pencil", place: "front_lower_margin" },
      certificate: { kind: "none" },
      confirmed: { by: "seed:acceptance", at: new Date("2026-10-28T09:00:00Z") },
    });
    const authority = createDrizzleSaleAuthorityWriter(db, "off");
    await grantSeedAuthorityForArtwork(
      db,
      authority.grantSaleAuthority.bind(authority),
      run.artworkId,
    );
  }
  const [holdEdition] = await db
    .select({ id: shopEdition.id })
    .from(shopEdition)
    .where(
      and(eq(shopEdition.artworkId, run.artworkId), eq(shopEdition.listingStatus, "authorised")),
    )
    .orderBy(asc(shopEdition.stockRef))
    .limit(1);
  if (!holdEdition) throw new Error("The acceptance custom run has no print on sale");
  return {
    originalArtworkId: original.artworkId,
    runArtworkId: run.artworkId,
    runSlug: SHOP_ACCEPTANCE_CUSTOM_RUN_SLUG,
    holdEditionId: holdEdition.id,
  };
}
