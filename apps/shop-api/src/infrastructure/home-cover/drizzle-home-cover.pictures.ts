import type { Database } from "@auction/db";
import {
  shopArtist,
  shopArtwork,
  shopArtworkImage,
  shopMediaAsset,
  shopParty,
} from "@auction/db/schema";
import type { ObjectStoragePort } from "@auction/object-storage";
import type { AdminHomeCoverPictureCandidate } from "@auction/shop-contracts";
import { type SQL, and, asc, desc, eq, isNull, ne, or, sql } from "drizzle-orm";
import type { HomeCoverPictures } from "../../application/home-cover/home-cover.ports.js";
import { publicArtworkVisible } from "../artwork-visibility-sql.js";
import { containsPattern } from "../drizzle-editorial-search.reader.js";
import { listedOnSalesChannelSql } from "../sales-channel-listing-sql.js";

/** A picture is read in full to be measured; the media policy caps uploads at 10 MB. */
const MAX_PICTURE_BYTES = 10 * 1024 * 1024;

type ResolveMediaUrl = (value: string | null | undefined) => string | null;

/**
 * The Shop's own pictures: uploads LAX Admin confirmed (never an artist's application image) and
 * the pictures on Shop editions. A key outside these is unknown, whatever the bucket holds.
 */
export function createDrizzleHomeCoverPictures(
  db: Database,
  deps: { storage: ObjectStoragePort | null; resolveMediaUrl: ResolveMediaUrl },
): HomeCoverPictures {
  async function isShopPicture(mediaKey: string): Promise<boolean> {
    const [uploaded] = await db
      .select({ key: shopMediaAsset.key })
      .from(shopMediaAsset)
      .where(
        and(
          eq(shopMediaAsset.key, mediaKey),
          eq(shopMediaAsset.status, "active"),
          ne(shopMediaAsset.kind, "artist_application_image"),
        ),
      )
      .limit(1);
    if (uploaded) return true;
    const [onEdition] = await db
      .select({ key: shopArtworkImage.mediaKey })
      .from(shopArtworkImage)
      .where(eq(shopArtworkImage.mediaKey, mediaKey))
      .limit(1);
    return Boolean(onEdition);
  }

  return {
    async load(mediaKey) {
      if (!deps.storage || !(await isShopPicture(mediaKey))) return null;
      const head = await deps.storage.headObject(mediaKey);
      if (!head || head.byteSize <= 0 || head.byteSize > MAX_PICTURE_BYTES) return null;
      return deps.storage.getObjectBytes(mediaKey, head.byteSize);
    },

    async search(query): Promise<AdminHomeCoverPictureCandidate[]> {
      const like = query.q?.trim() ? containsPattern(query.q.trim()) : null;
      const live: SQL = and(
        listedOnSalesChannelSql("shop"),
        publicArtworkVisible(),
        isNull(shopArtwork.archivedAt),
      ) as SQL;
      const rows = await db
        .select({
          mediaKey: shopArtworkImage.mediaKey,
          title: shopArtwork.title,
          artistName: shopParty.displayName,
        })
        .from(shopArtworkImage)
        .innerJoin(shopArtwork, eq(shopArtworkImage.artworkId, shopArtwork.id))
        .innerJoin(shopArtist, eq(shopArtwork.artistId, shopArtist.id))
        .innerJoin(shopParty, eq(shopArtist.partyId, shopParty.id))
        .where(
          and(
            live,
            like
              ? or(
                  sql`${shopArtwork.title} ILIKE ${like}`,
                  sql`${shopParty.displayName} ILIKE ${like}`,
                )
              : undefined,
          ),
        )
        .orderBy(desc(shopArtwork.createdAt), asc(shopArtwork.id), asc(shopArtworkImage.position))
        .limit(query.limit);
      return rows.flatMap((row) => {
        const imageUrl = deps.resolveMediaUrl(row.mediaKey);
        return imageUrl
          ? [
              {
                mediaKey: row.mediaKey,
                imageUrl,
                artworkTitle: row.title,
                artistName: row.artistName,
              },
            ]
          : [];
      });
    },
  };
}
