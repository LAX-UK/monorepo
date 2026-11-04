import { randomUUID } from "node:crypto";
import type { Database } from "@auction/db";
import { shopArtwork } from "@auction/db/schema";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { eq } from "drizzle-orm";
import type { LinkedListingWriter } from "../../application/edition-runs/edition-run.ports.js";
import type { ShopDomainEventWriter } from "../../application/ports/shop-domain-event.writer.js";
import { ShopApiError, notFound } from "../../errors/shop-api-error.js";
import { withCatalogueSlugConflict } from "../catalogue-unique-violation.js";
import { copyArtworkImages, nextFreeSlug } from "./draft-listing-copy.js";

/**
 * A new draft artwork for a proof or companion listing: the main run's artist, details and
 * images (so both are of the same image), on LAX Shop, with no run yet.
 */
export function createDrizzleLinkedListingWriter(
  db: Database,
  events: ShopDomainEventWriter,
): LinkedListingWriter {
  async function copy(input: Parameters<LinkedListingWriter["copyFromMainRun"]>[0]) {
    const slug =
      input.onSlugTaken === "next_free" ? await nextFreeSlug(db, input.slug) : input.slug;
    const [main] = await db
      .select()
      .from(shopArtwork)
      .where(eq(shopArtwork.id, input.mainArtworkId))
      .limit(1);
    if (!main) throw notFound("Artwork not found");
    const importKey = `staff:${randomUUID()}`;
    const [artwork] = await withCatalogueSlugConflict(() =>
      db
        .insert(shopArtwork)
        .values({
          slug,
          title: input.title,
          artistId: main.artistId,
          yearCreated: main.yearCreated,
          medium: main.medium,
          dimensions: main.dimensions,
          description: main.description,
          eligibleForEditionAllocation: true,
          printPricePence: input.printPricePence,
          saleState: "for_sale",
          salesChannel: "shop",
          sourceOriginalArtworkId: main.sourceOriginalArtworkId,
          primaryImageUrl: main.primaryImageUrl,
          importKey,
          publishedAt: null,
        })
        .returning(),
    );
    if (!artwork) {
      throw new ShopApiError(SHOP_API_ERROR_CODES.INTERNAL, "Failed to create the listing", 500);
    }
    await copyArtworkImages(db, main.id, artwork.id);
    await events.append({
      aggregateType: "shop_artwork",
      aggregateId: artwork.id,
      eventType: "shop.artwork.created",
      payload: {
        schemaVersion: 1,
        importKey,
        slug: artwork.slug,
        eligibleForEditionAllocation: true,
      },
    });
    return { artworkId: artwork.id, slug: artwork.slug, version: artwork.updatedAt.toISOString() };
  }

  return { copyFromMainRun: copy };
}
