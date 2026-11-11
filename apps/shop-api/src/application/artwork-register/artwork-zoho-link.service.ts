import type { ArtworkRegisterEntry } from "@auction/artwork-register-contracts";
import type {
  AdminArtworkDetail,
  AdminBidLotRef,
  AdminCatalogueChange,
  AdminLaxArtListing,
} from "@auction/shop-contracts";
import type { AdminArtworkReader } from "../ports/artwork-catalogue-admin.js";
import type { RegisterEventRecord } from "../ports/artwork-register-review.ports.js";
import type { LaxArtListingReader } from "../ports/offer-on-lax-art.ports.js";
import type { StaffNameReader } from "../ports/staff-name.reader.js";
import { presentRegisterEvent, recentMovesOf, staffIdsOf } from "./register-event.presenter.js";
import { presentWhereItIs } from "./where-it-is.presenter.js";

/** LAX Bid's draft lot for a record. Asking can fail; the page then reads as if there were none. */
export type ZohoLinkBidDrafts = {
  findDraftLot(registerId: string): Promise<AdminBidLotRef | null>;
};

/** Where the lax.art listing no longer matches Zoho. Asking can fail; the page then shows no change. */
export type ZohoLinkCatalogueChanges = {
  laxArtChange(entry: ArtworkRegisterEntry): Promise<AdminCatalogueChange | null>;
};

export type ZohoLinkRegister = {
  findByZohoProductId(zohoProductId: string): Promise<ArtworkRegisterEntry | null>;
  listEvents(registerId: string, limit: number): Promise<RegisterEventRecord[]>;
};

type ZohoLink = NonNullable<AdminArtworkDetail["zohoLink"]>;

/** Enough history to find the last move into the current place. */
const HISTORY_LIMIT = 100;
const RECENT_MOVES = 3;

/**
 * The Zoho record behind a lax.art artwork, for its page: the stock code, Zoho's status and where
 * the artwork is. An artwork with no record, or whose record is gone, has no link.
 */
export class ArtworkZohoLinkService {
  constructor(
    private readonly deps: {
      register: ZohoLinkRegister;
      staffNames: StaffNameReader;
      bidDrafts: ZohoLinkBidDrafts;
      catalogueChanges: ZohoLinkCatalogueChanges;
      now?: () => Date;
    },
  ) {}

  async linkFor(artwork: {
    zohoProductId: string | null;
    published: boolean;
    artworkId: string;
    slug: string;
    createdAt: string;
  }): Promise<ZohoLink | null> {
    if (!artwork.zohoProductId) return null;
    const entry = await this.deps.register.findByZohoProductId(artwork.zohoProductId);
    if (!entry) return null;
    const [events, bidDraft, catalogueChange] = await Promise.all([
      this.deps.register.listEvents(entry.id, HISTORY_LIMIT),
      this.bidDraftFor(entry),
      this.deps.catalogueChanges.laxArtChange(entry).catch(() => null),
    ]);
    const laxArt: AdminLaxArtListing = {
      artworkId: artwork.artworkId,
      slug: artwork.slug,
      published: artwork.published,
      createdAt: artwork.createdAt,
    };
    const moves = recentMovesOf(events, RECENT_MOVES);
    const names = await this.deps.staffNames.namesFor(staffIdsOf(moves));
    return {
      registerId: entry.id,
      zohoProductId: entry.zohoProductId,
      stockCode: entry.stockCode,
      zohoStatus: entry.catalogueStatus,
      whereItIs: presentWhereItIs({
        entry,
        events,
        laxArt,
        bidDraft,
        now: (this.deps.now ?? (() => new Date()))(),
      }),
      recentMoves: moves.map((event) => presentRegisterEvent(event, names)),
      catalogueChange,
    };
  }

  /** Only a held or withdrawn artwork can have a draft lot; nothing else is worth asking about. */
  private async bidDraftFor(entry: ArtworkRegisterEntry): Promise<AdminBidLotRef | null> {
    const { state } = entry.offer;
    if (state !== "held" && state !== "withdrawn") return null;
    const draft = await this.deps.bidDrafts.findDraftLot(entry.id).catch(() => null);
    return draft ? { lotId: draft.lotId, saleTitle: draft.saleTitle } : null;
  }
}

/**
 * The artwork reader with the Zoho record behind each lax.art original added to its detail. The
 * list is untouched: the link is only read for the one artwork on a page.
 */
export function withZohoLinks(
  reader: AdminArtworkReader,
  deps: { links: ArtworkZohoLinkService; listings: Pick<LaxArtListingReader, "findZohoProductId"> },
): AdminArtworkReader {
  return {
    listArtworks: (input) => reader.listArtworks(input),
    async getArtwork(artworkId) {
      const detail = await reader.getArtwork(artworkId);
      if (!detail || detail.run !== null) return detail;
      const zohoProductId = await deps.listings.findZohoProductId(artworkId);
      const zohoLink = await deps.links.linkFor({
        zohoProductId,
        published: detail.state === "live" || detail.state === "sold_out",
        artworkId: detail.artworkId,
        slug: detail.slug,
        createdAt: detail.createdAt,
      });
      return { ...detail, zohoLink };
    },
  };
}
