import type { Database } from "@auction/db";
import { shopArtist, shopArtwork, shopArtworkImage } from "@auction/db/schema";
import { asc, eq, sql } from "drizzle-orm";
import type {
  LinkedListingProjector,
  ListingFacts,
} from "../integrations/zoho/artwork/linked-listing-projector.js";

/**
 * Writes Zoho's title, medium, size, year, artist and images onto the lax.art listing made from
 * the record, in one transaction, and only when something differs. The artist follows Zoho's
 * artist code; a code no lax.art artist carries leaves the artist as it is.
 */
export class DrizzleLinkedListingProjector implements LinkedListingProjector {
  constructor(private readonly db: Database) {}

  async project(facts: ListingFacts): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [listing] = await tx
        .select({
          id: shopArtwork.id,
          title: shopArtwork.title,
          medium: shopArtwork.medium,
          dimensions: shopArtwork.dimensions,
          yearCreated: shopArtwork.yearCreated,
          artistId: shopArtwork.artistId,
        })
        .from(shopArtwork)
        .where(eq(shopArtwork.zohoProductId, facts.zohoProductId))
        .for("update")
        .limit(1);
      if (!listing) return;

      const [artist] = await tx
        .select({ id: shopArtist.id })
        .from(shopArtist)
        .where(eq(shopArtist.zohoArtistCode, facts.artistCode))
        .limit(1);

      const current = await tx
        .select({ mediaKey: shopArtworkImage.mediaKey })
        .from(shopArtworkImage)
        .where(eq(shopArtworkImage.artworkId, listing.id))
        .orderBy(asc(shopArtworkImage.position));
      const nextKeys = [...new Set(facts.imageRefs)];
      const imagesChanged = current.map((row) => row.mediaKey).join("\n") !== nextKeys.join("\n");

      const fieldsChanged =
        listing.title !== facts.title ||
        listing.medium !== facts.medium ||
        listing.dimensions !== facts.dimensions ||
        listing.yearCreated !== facts.year ||
        (artist !== undefined && listing.artistId !== artist.id);
      if (!fieldsChanged && !imagesChanged) return;

      if (imagesChanged) {
        await tx.delete(shopArtworkImage).where(eq(shopArtworkImage.artworkId, listing.id));
        if (nextKeys.length > 0) {
          await tx.insert(shopArtworkImage).values(
            nextKeys.map((mediaKey, position) => ({
              artworkId: listing.id,
              mediaKey,
              position,
              alt: null,
            })),
          );
        }
      }
      await tx
        .update(shopArtwork)
        .set({
          title: facts.title,
          medium: facts.medium,
          dimensions: facts.dimensions,
          yearCreated: facts.year,
          ...(artist ? { artistId: artist.id } : {}),
          updatedAt: sql`now()`,
        })
        .where(eq(shopArtwork.id, listing.id));
    });
  }
}
