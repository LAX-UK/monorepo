import type { MatchValidator, PendingMatch } from "@auction/alerts";
import type { Database } from "@auction/db";
import { shopAlertAnnouncement, shopArtist, shopArtwork, shopParty } from "@auction/db/schema";
import { isArtOriginalRelease, isShopEditionRelease } from "@auction/shop-domain";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { artworkIdOfItemKey, artworkItemKey } from "../../application/alerts/alert-items.js";
import type {
  AlertArtwork,
  AlertArtworkReader,
  AnnouncementQueue,
} from "../../application/alerts/alert-ports.js";
import { publicArtworkVisible } from "../artwork-visibility-sql.js";

type ResolveMediaUrl = (value: string | null | undefined) => string | null;

/** The published editions and originals alerts are sent for; the same rule the migration seeds. */
const alertWorthy = sql`(
  (${shopArtwork.salesChannel} = 'shop' AND ${shopArtwork.eligibleForEditionAllocation})
  OR (${shopArtwork.salesChannel} = 'art' AND ${shopArtwork.sourceOriginalArtworkId} IS NULL)
)`;

function kindOf(row: {
  salesChannel: string;
  eligibleForEditionAllocation: boolean;
  sourceOriginalArtworkId: string | null;
}): AlertArtwork["kind"] | null {
  if (isShopEditionRelease(row)) return "shop_release";
  if (isArtOriginalRelease(row)) return "art_original";
  return null;
}

/** Reads the catalogue for the alert engine: what a work is, whether it is still on sale. */
export class ShopAlertCatalogue implements AlertArtworkReader, AnnouncementQueue, MatchValidator {
  constructor(
    private readonly db: Database,
    private readonly resolveMediaUrl: ResolveMediaUrl,
  ) {}

  async find(artworkId: string): Promise<AlertArtwork | null> {
    const [row] = await this.db
      .select({
        id: shopArtwork.id,
        slug: shopArtwork.slug,
        title: shopArtwork.title,
        artistId: shopArtwork.artistId,
        artistName: shopParty.displayName,
        image: shopArtwork.primaryImageUrl,
        salesChannel: shopArtwork.salesChannel,
        eligibleForEditionAllocation: shopArtwork.eligibleForEditionAllocation,
        sourceOriginalArtworkId: shopArtwork.sourceOriginalArtworkId,
        publishedAt: shopArtwork.publishedAt,
        archivedAt: shopArtwork.archivedAt,
      })
      .from(shopArtwork)
      .innerJoin(shopArtist, eq(shopArtwork.artistId, shopArtist.id))
      .innerJoin(shopParty, eq(shopArtist.partyId, shopParty.id))
      .where(eq(shopArtwork.id, artworkId))
      .limit(1);
    const kind = row ? kindOf(row) : null;
    if (!row || !kind) return null;
    const image = this.resolveMediaUrl(row.image);
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      artistId: row.artistId,
      artistName: row.artistName,
      imageUrl: image && /^https?:\/\//.test(image) ? image : null,
      kind,
      published: row.publishedAt !== null && row.archivedAt === null,
    };
  }

  async listUnexpanded(limit: number) {
    return this.db
      .select({ itemKey: shopAlertAnnouncement.itemKey, announce: shopAlertAnnouncement.announce })
      .from(shopAlertAnnouncement)
      .innerJoin(
        shopArtwork,
        sql`${shopAlertAnnouncement.itemKey} = 'artwork:' || ${shopArtwork.id}::text`,
      )
      .where(and(isNull(shopAlertAnnouncement.expandedAt), publicArtworkVisible(), alertWorthy))
      .orderBy(asc(shopAlertAnnouncement.announcedAt), asc(shopAlertAnnouncement.itemKey))
      .limit(limit);
  }

  /** A work taken off sale since it matched is dropped from the digest: it can't be bought. */
  async staleMatches(matches: readonly PendingMatch[]) {
    const ids = matches
      .map((m) => artworkIdOfItemKey(m.itemKey))
      .filter((id): id is string => id !== null);
    const stale = new Map<string, string>();
    if (ids.length === 0) return stale;
    const visible = await this.db
      .select({ id: shopArtwork.id })
      .from(shopArtwork)
      .where(and(inArray(shopArtwork.id, ids), publicArtworkVisible()));
    const onSale = new Set(visible.map((r) => artworkItemKey(r.id)));
    for (const match of matches) {
      if (!onSale.has(match.itemKey)) stale.set(match.id, "withdrawn");
    }
    return stale;
  }
}
