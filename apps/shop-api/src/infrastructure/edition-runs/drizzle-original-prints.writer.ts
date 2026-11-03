import { randomUUID } from "node:crypto";
import type { Database } from "@auction/db";
import { shopArtwork } from "@auction/db/schema";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { eq } from "drizzle-orm";
import type { OriginalPrintsWriter } from "../../application/edition-runs/edition-run.ports.js";
import { ShopApiError, notFound } from "../../errors/shop-api-error.js";
import { withCatalogueSlugConflict } from "../catalogue-unique-violation.js";
import { copyArtworkImages, nextFreeSlug } from "./draft-listing-copy.js";

/**
 * A new Shop draft for prints of an original: the original's artist, details and images, linked
 * to it, with no run or price yet. The run is recorded by the caller, in the same transaction.
 */
export function createDrizzleOriginalPrintsWriter(db: Database): OriginalPrintsWriter {
  return {
    async copyFromOriginal(input) {
      const [original] = await db
        .select()
        .from(shopArtwork)
        .where(eq(shopArtwork.id, input.originalArtworkId))
        .limit(1);
      if (!original) throw notFound("Artwork not found");
      const slug = await nextFreeSlug(db, input.slug);
      const importKey = `staff:${randomUUID()}`;
      const [artwork] = await withCatalogueSlugConflict(() =>
        db
          .insert(shopArtwork)
          .values({
            slug,
            title: input.title,
            artistId: original.artistId,
            yearCreated: original.yearCreated,
            medium: original.medium,
            dimensions: original.dimensions,
            description: original.description,
            eligibleForEditionAllocation: true,
            printPricePence: null,
            saleState: "for_sale",
            salesChannel: "shop",
            sourceOriginalArtworkId: original.id,
            primaryImageUrl: original.primaryImageUrl,
            importKey,
            publishedAt: null,
          })
          .returning(),
      );
      if (!artwork) {
        throw new ShopApiError(SHOP_API_ERROR_CODES.INTERNAL, "Failed to create the prints", 500);
      }
      await copyArtworkImages(db, original.id, artwork.id);
      return { artworkId: artwork.id, slug: artwork.slug, importKey };
    },
  };
}
