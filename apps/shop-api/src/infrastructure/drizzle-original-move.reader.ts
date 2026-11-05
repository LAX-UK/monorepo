import type { Database } from "@auction/db";
import {
  shopArtist,
  shopArtwork,
  shopArtworkImage,
  shopOriginalSale,
  shopParty,
} from "@auction/db/schema";
import { and, asc, eq, notInArray } from "drizzle-orm";
import type { OriginalForMove, OriginalMoveReader } from "../application/ports/original-move.js";

/** Reads what a move needs to know about an original, from Shop's own tables. */
export function createDrizzleOriginalMoveReader(db: Database): OriginalMoveReader {
  async function load(where: ReturnType<typeof eq>): Promise<OriginalForMove | null> {
    const [row] = await db
      .select({
        artwork: shopArtwork,
        artistName: shopParty.displayName,
      })
      .from(shopArtwork)
      .innerJoin(shopArtist, eq(shopArtwork.artistId, shopArtist.id))
      .innerJoin(shopParty, eq(shopArtist.partyId, shopParty.id))
      .where(where)
      .limit(1);
    if (!row) return null;
    const { artwork } = row;
    const [images, openSale] = await Promise.all([
      db
        .select({ mediaKey: shopArtworkImage.mediaKey })
        .from(shopArtworkImage)
        .where(eq(shopArtworkImage.artworkId, artwork.id))
        .orderBy(asc(shopArtworkImage.position)),
      db
        .select({ id: shopOriginalSale.id })
        .from(shopOriginalSale)
        .where(
          and(
            eq(shopOriginalSale.artworkId, artwork.id),
            notInArray(shopOriginalSale.status, ["assigned", "cancelled"]),
          ),
        )
        .limit(1),
    ]);
    return {
      artworkId: artwork.id,
      title: artwork.title,
      artistName: row.artistName,
      description: artwork.description,
      provenance: artwork.provenance,
      medium: artwork.medium,
      dimensions: artwork.dimensions,
      yearCreated: artwork.yearCreated,
      imageKeys: images.map((image) => image.mediaKey),
      primaryImageUrl: artwork.primaryImageUrl,
      zohoProductId: artwork.zohoProductId,
      salesChannel: artwork.salesChannel,
      runKind: artwork.runKind,
      markedSold: artwork.saleState === "sold",
      onLaxArt: artwork.publishedAt !== null && artwork.archivedAt === null,
      archived: artwork.archivedAt !== null,
      openOriginalSale: openSale.length > 0,
    };
  }

  return {
    findById: (artworkId) => load(eq(shopArtwork.id, artworkId)),
    findByZohoProductId: (zohoProductId) => load(eq(shopArtwork.zohoProductId, zohoProductId)),
  };
}
