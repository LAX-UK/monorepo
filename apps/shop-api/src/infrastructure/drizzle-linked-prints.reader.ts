import type { Database } from "@auction/db";
import { shopArtwork, shopEdition } from "@auction/db/schema";
import type { AdminArtworkDetail } from "@auction/shop-contracts";
import { artworkCatalogueState } from "@auction/shop-domain";
import { asc, eq, sql } from "drizzle-orm";

/** The Shop listings made from an original, oldest first, each with its state and run size. */
export async function readLinkedPrints(
  db: Database,
  originalArtworkId: string,
): Promise<NonNullable<AdminArtworkDetail["linkedPrints"]>> {
  const rows = await db
    .select({
      artworkId: shopArtwork.id,
      slug: shopArtwork.slug,
      title: shopArtwork.title,
      publishedAt: shopArtwork.publishedAt,
      archivedAt: shopArtwork.archivedAt,
      saleState: shopArtwork.saleState,
      eligibleForEditionAllocation: shopArtwork.eligibleForEditionAllocation,
      size: sql<number>`count(${shopEdition.id})::int`,
      sold: sql<number>`(count(*) filter (where ${shopEdition.listingStatus} = 'sold'))::int`,
    })
    .from(shopArtwork)
    .leftJoin(shopEdition, eq(shopEdition.artworkId, shopArtwork.id))
    .where(eq(shopArtwork.sourceOriginalArtworkId, originalArtworkId))
    .groupBy(shopArtwork.id)
    .orderBy(asc(shopArtwork.createdAt), asc(shopArtwork.id));
  return rows.map((row) => ({
    artworkId: row.artworkId,
    slug: row.slug,
    title: row.title,
    size: Number(row.size),
    state: artworkCatalogueState({
      publishedAt: row.publishedAt,
      archivedAt: row.archivedAt,
      saleState: row.saleState,
      eligibleForEditionAllocation: row.eligibleForEditionAllocation,
      editionCount: Number(row.size),
      soldEditionCount: Number(row.sold),
    }),
  }));
}
