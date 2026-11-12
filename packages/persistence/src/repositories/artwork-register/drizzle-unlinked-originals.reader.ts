import type { Database } from "@auction/db";
import { lot, shopArtist, shopArtwork, shopParty } from "@auction/db/schema";
import { and, asc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import type {
  IUnlinkedOriginalsReader,
  UnlinkedOriginal,
  UnlinkedOriginalsReport,
} from "../../interfaces/artwork-register-integrity.js";

/** An original on lax.art that is on the storefront but has no Zoho record. */
const liveLaxArtOriginal = and(
  isNull(shopArtwork.zohoProductId),
  eq(shopArtwork.salesChannel, "art"),
  isNull(shopArtwork.runKind),
  eq(shopArtwork.eligibleForEditionAllocation, false),
  isNotNull(shopArtwork.publishedAt),
  isNull(shopArtwork.archivedAt),
);

/** A lot made in LAX Bid that is published (waiting or running) and points at no register entry. */
const liveBidLot = and(
  isNull(lot.artworkRegisterId),
  isNull(lot.deletedAt),
  inArray(lot.status, ["scheduled", "active"]),
);

const BID_STATE = { scheduled: "Scheduled", active: "Live" } as const;

export class DrizzleUnlinkedOriginalsReader implements IUnlinkedOriginalsReader {
  constructor(private readonly db: Database) {}

  async listLiveUnlinkedOriginals(limit: number): Promise<UnlinkedOriginalsReport> {
    const [laxArt, bid, laxArtCount, bidCount] = await Promise.all([
      this.db
        .select({ id: shopArtwork.id, title: shopArtwork.title, artist: shopParty.displayName })
        .from(shopArtwork)
        .innerJoin(shopArtist, eq(shopArtwork.artistId, shopArtist.id))
        .innerJoin(shopParty, eq(shopArtist.partyId, shopParty.id))
        .where(liveLaxArtOriginal)
        .orderBy(asc(shopArtwork.title), asc(shopArtwork.id))
        .limit(limit),
      this.db
        .select({ id: lot.id, title: lot.title, status: lot.status })
        .from(lot)
        .where(liveBidLot)
        .orderBy(asc(lot.title), asc(lot.id))
        .limit(limit),
      this.db
        .select({ total: sql<number>`count(*)::int` })
        .from(shopArtwork)
        .where(liveLaxArtOriginal),
      this.db.select({ total: sql<number>`count(*)::int` }).from(lot).where(liveBidLot),
    ]);
    const items: UnlinkedOriginal[] = [
      ...bid.map((row) => ({
        product: "bid" as const,
        id: row.id,
        title: row.title,
        artistName: null,
        state: BID_STATE[row.status as keyof typeof BID_STATE] ?? row.status,
      })),
      ...laxArt.map((row) => ({
        product: "lax_art" as const,
        id: row.id,
        title: row.title,
        artistName: row.artist,
        state: "Published",
      })),
    ];
    return { items, counts: { bid: bidCount[0]?.total ?? 0, laxArt: laxArtCount[0]?.total ?? 0 } };
  }
}
