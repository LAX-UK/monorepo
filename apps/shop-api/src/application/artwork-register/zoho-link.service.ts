import type { ArtworkRegisterEntry } from "@auction/artwork-register-contracts";
import {
  type AdminZohoLinkBody,
  type AdminZohoLinkBulkResult,
  type AdminZohoLinkCandidate,
  type AdminZohoLinkCount,
  type AdminZohoLinkOutcome,
  type AdminZohoLinkPreview,
  type AdminZohoLinkRecord,
  type AdminZohoLinkReport,
  type AdminZohoLinkRow,
  type AdminZohoLinkSearchResult,
  type AdminZohoLinkSettings,
  type AdminZohoUnlinkBody,
  type AdminZohoUnlinkResult,
  SHOP_API_ERROR_CODES,
} from "@auction/shop-contracts";
import { ShopApiError } from "../../errors/shop-api-error.js";
import type { LaxArtArtistDirectory } from "../ports/offer-on-lax-art.ports.js";
import {
  type UnlinkedListing,
  type ZohoLinkListingReader,
  type ZohoLinkRecordReader,
  ZohoLinkRefusedError,
  type ZohoLinkSettingsStore,
  type ZohoLinkWriter,
} from "../ports/zoho-link.ports.js";
import { laxArtOfferBlockers } from "./lax-art-offer-blockers.js";
import { type ArtistForCode, planLink } from "./zoho-link-differences.js";
import { type ListingMatch, type MatchRecord, matchListings } from "./zoho-link-matcher.js";

export type ZohoLinkDeps = {
  listings: ZohoLinkListingReader;
  records: ZohoLinkRecordReader;
  artists: LaxArtArtistDirectory;
  writer: ZohoLinkWriter;
  settings: ZohoLinkSettingsStore;
  now?: () => Date;
};

const SEARCH_LIMIT = 20;

const WHERE_IT_IS: Record<string, string> = {
  held: "Not offered",
  lax_art: "On lax.art",
  bid_sale: "In a LAX Bid sale",
  private_sale: "In a private sale",
  sold: "Sold",
  withdrawn: "Withdrawn",
};

const toMatchRecord = (entry: ArtworkRegisterEntry): MatchRecord => ({
  registerId: entry.id,
  stockCode: entry.stockCode,
  title: entry.title,
  artistCode: entry.artist.code,
  dimensions: entry.dimensions,
  year: entry.year,
});

function presentRecord(entry: ArtworkRegisterEntry): AdminZohoLinkRecord {
  return {
    registerId: entry.id,
    stockCode: entry.stockCode,
    title: entry.title,
    artistName: entry.artist.name,
    artistCode: entry.artist.code,
    dimensions: entry.dimensions,
    year: entry.year,
    zohoStatus: entry.catalogueStatus,
    whereItIs: WHERE_IT_IS[entry.offer.state] ?? entry.offer.state,
  };
}

function presentListing(listing: UnlinkedListing): AdminZohoLinkRow["listing"] {
  return {
    artworkId: listing.artworkId,
    slug: listing.slug,
    title: listing.title,
    artistName: listing.artistName,
    artistCode: listing.artistCode,
    stockCode: listing.stockCode,
    dimensions: listing.dimensions,
    year: listing.year,
    published: listing.published,
  };
}

/**
 * The "Link lax.art" report and the links it leads to. Matching is read-only and never links;
 * linking happens only when staff confirm, and the register's lock decides whether it may.
 */
export class ZohoLinkService {
  constructor(private readonly deps: ZohoLinkDeps) {}

  private now(): Date {
    return (this.deps.now ?? (() => new Date()))();
  }

  async count(): Promise<AdminZohoLinkCount> {
    return { unlinked: await this.deps.listings.countUnlinked() };
  }

  /** Matches every unlinked original. Reads only; "Check again" calls this again. */
  async report(): Promise<AdminZohoLinkReport> {
    const [listings, records, block] = await Promise.all([
      this.deps.listings.listUnlinked(),
      this.deps.records.listLinkable(),
      this.deps.settings.blockUnlinkedPublish(),
    ]);
    const byId = new Map(records.map((record) => [record.id, record]));
    const matches = matchListings(listings, records.map(toMatchRecord));
    const artistCache = new Map<string, ArtistForCode>();
    const artistFor = async (code: string): Promise<ArtistForCode> => {
      if (!artistCache.has(code)) {
        artistCache.set(code, await this.artistForCode(code));
      }
      return artistCache.get(code) ?? null;
    };

    const matched: AdminZohoLinkRow[] = [];
    const needsChoice: AdminZohoLinkRow[] = [];
    const noMatch: AdminZohoLinkRow[] = [];
    for (const listing of listings) {
      const match = matches.get(listing.artworkId) ?? {
        kind: "none" as const,
        reason: "no_record_for_artist_and_title" as const,
      };
      const row = await this.row(listing, match, byId, artistFor);
      if (match.kind === "matched") matched.push(row);
      else if (match.kind === "choice") needsChoice.push(row);
      else noMatch.push(row);
    }
    return {
      checkedAt: this.now().toISOString(),
      counts: {
        unlinked: listings.length,
        matched: matched.length,
        needsChoice: needsChoice.length,
        noMatch: noMatch.length,
      },
      matched,
      needsChoice,
      noMatch,
      blockUnlinkedPublish: block,
    };
  }

  private async row(
    listing: UnlinkedListing,
    match: ListingMatch,
    byId: ReadonlyMap<string, ArtworkRegisterEntry>,
    artistFor: (code: string) => Promise<ArtistForCode>,
  ): Promise<AdminZohoLinkRow> {
    const ids =
      match.kind === "matched"
        ? [match.registerId]
        : match.kind === "choice"
          ? match.registerIds
          : [];
    const candidates: AdminZohoLinkCandidate[] = [];
    for (const id of ids) {
      const entry = byId.get(id);
      if (entry)
        candidates.push(await this.candidate(listing, entry, await artistFor(entry.artist.code)));
    }
    return {
      listing: presentListing(listing),
      candidates,
      rule: match.kind === "matched" ? match.rule : null,
      reason: match.kind === "none" ? match.reason : null,
    };
  }

  private async candidate(
    listing: UnlinkedListing,
    entry: ArtworkRegisterEntry,
    artist: ArtistForCode,
  ): Promise<AdminZohoLinkCandidate> {
    const plan = planLink(listing, entry, artist);
    const blockers = laxArtOfferBlockers(entry, { kind: "shop_artwork", id: listing.artworkId });
    return {
      record: presentRecord(entry),
      differences: plan.differences,
      refusal: blockers[0]?.message ?? plan.artistRefusal,
    };
  }

  private async artistForCode(code: string): Promise<ArtistForCode> {
    const found = await this.deps.artists.findByZohoArtistCode(code);
    return found
      ? { artistId: found.artistId, displayName: found.displayName, archived: found.archived }
      : null;
  }

  /** What linking this artwork to this record would change, for the dialog before confirming. */
  async preview(artworkId: string, registerId: string): Promise<AdminZohoLinkPreview> {
    const [listing, entry] = await Promise.all([
      this.deps.listings.findUnlinked(artworkId),
      this.deps.records.findById(registerId),
    ]);
    if (!listing)
      throw new ShopApiError(
        SHOP_API_ERROR_CODES.NOT_FOUND,
        "That artwork is not waiting to be linked.",
        404,
      );
    if (!entry)
      throw new ShopApiError(
        SHOP_API_ERROR_CODES.NOT_FOUND,
        "That Zoho record was not found.",
        404,
      );
    return {
      listing: presentListing(listing),
      candidate: await this.candidate(listing, entry, await this.artistForCode(entry.artist.code)),
    };
  }

  /** Looks through the register for the record of one artwork; records already linked are left out. */
  async search(query: string): Promise<AdminZohoLinkSearchResult> {
    const found = await this.deps.records.search(query.trim(), SEARCH_LIMIT + 1);
    return {
      items: found.slice(0, SEARCH_LIMIT).map(presentRecord),
      more: found.length > SEARCH_LIMIT,
    };
  }

  /** Links one artwork. Repeating it is the same result with `already_linked`. */
  async link(body: AdminZohoLinkBody, actorSubjectId: string): Promise<AdminZohoLinkOutcome> {
    try {
      const written = await this.deps.writer.link({ ...body, actorSubjectId });
      return {
        ...body,
        status: written.linked ? "linked" : "already_linked",
        message: null,
        nowOnLaxArt: written.nowOnLaxArt,
        replaced: written.replaced as AdminZohoLinkOutcome["replaced"],
      };
    } catch (error) {
      if (error instanceof ZohoLinkRefusedError) {
        return {
          ...body,
          status: "refused",
          message: error.message,
          nowOnLaxArt: false,
          replaced: [],
        };
      }
      throw error;
    }
  }

  /**
   * Links the pairs staff confirmed in bulk. Only Matched rows are linked in bulk: each pair is
   * matched again first, and one that is no longer the match is left alone.
   */
  async linkBulk(
    links: readonly AdminZohoLinkBody[],
    actorSubjectId: string,
  ): Promise<AdminZohoLinkBulkResult> {
    const [listings, records] = await Promise.all([
      this.deps.listings.listUnlinked(),
      this.deps.records.listLinkable(),
    ]);
    const matches = matchListings(listings, records.map(toMatchRecord));
    const linkedAlready = new Set<string>();
    const outcomes: AdminZohoLinkOutcome[] = [];
    for (const link of links) {
      const match = matches.get(link.artworkId);
      const stillMatched = match?.kind === "matched" && match.registerId === link.registerId;
      if (!stillMatched && !(await this.alreadyLinkedTo(link))) {
        outcomes.push({
          ...link,
          status: "not_a_match",
          message: "This is no longer the one match for the artwork. Check again.",
          nowOnLaxArt: false,
          replaced: [],
        });
        continue;
      }
      if (linkedAlready.has(link.artworkId)) continue;
      linkedAlready.add(link.artworkId);
      outcomes.push(await this.link(link, actorSubjectId));
    }
    return { outcomes };
  }

  /** A pair linked by an earlier click or another person: repeating it is allowed and changes nothing. */
  private async alreadyLinkedTo(link: AdminZohoLinkBody): Promise<boolean> {
    // The writer answers `already_linked` for exactly this pair; asking it is the one source of truth.
    return (await this.deps.listings.findUnlinked(link.artworkId)) === null;
  }

  async unlink(body: AdminZohoUnlinkBody, actorSubjectId: string): Promise<AdminZohoUnlinkResult> {
    const reason = body.reason.trim();
    if (reason === "") {
      throw new ShopApiError(
        SHOP_API_ERROR_CODES.VALIDATION,
        "Say why the link is being removed.",
        400,
      );
    }
    try {
      const unlinked = await this.deps.writer.unlink({
        artworkId: body.artworkId,
        reason,
        actorSubjectId,
      });
      return { artworkId: body.artworkId, unlinked };
    } catch (error) {
      if (error instanceof ZohoLinkRefusedError) {
        throw new ShopApiError(SHOP_API_ERROR_CODES.CONFLICT, error.message, 409);
      }
      throw error;
    }
  }

  async settings(): Promise<AdminZohoLinkSettings> {
    return { blockUnlinkedPublish: await this.deps.settings.blockUnlinkedPublish() };
  }

  async updateSettings(
    settings: AdminZohoLinkSettings,
    actorSubjectId: string,
  ): Promise<AdminZohoLinkSettings> {
    await this.deps.settings.setBlockUnlinkedPublish(settings.blockUnlinkedPublish, actorSubjectId);
    return this.settings();
  }
}
