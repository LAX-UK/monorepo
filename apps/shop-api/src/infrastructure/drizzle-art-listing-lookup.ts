import type { ArtListingFacts } from "@auction/artwork-register-contracts";
import type { Database } from "@auction/db";
import { shopArtwork } from "@auction/db/schema";
import { and, inArray, isNull } from "drizzle-orm";
import type { ArtListingLookup } from "../application/ports/art-listing-lookup.js";

/** Reads lax.art originals by the Zoho Product id they were made from. Editions are left out. */
export function createDrizzleArtListingLookup(db: Database): ArtListingLookup {
  return {
    async findByZohoProductIds(zohoProductIds) {
      const ids = [...new Set(zohoProductIds)];
      if (ids.length === 0) return [];
      const rows = await db
        .select({
          zohoProductId: shopArtwork.zohoProductId,
          artworkId: shopArtwork.id,
          slug: shopArtwork.slug,
          publishedAt: shopArtwork.publishedAt,
          archivedAt: shopArtwork.archivedAt,
        })
        .from(shopArtwork)
        .where(and(inArray(shopArtwork.zohoProductId, ids), isNull(shopArtwork.runKind)));
      return rows.flatMap((row): ArtListingFacts[] =>
        row.zohoProductId
          ? [
              {
                zohoProductId: row.zohoProductId,
                artworkId: row.artworkId,
                slug: row.slug,
                published: row.publishedAt !== null && row.archivedAt === null,
                publishedAt: row.publishedAt?.toISOString() ?? null,
                archived: row.archivedAt !== null,
              },
            ]
          : [],
      );
    },
  };
}
