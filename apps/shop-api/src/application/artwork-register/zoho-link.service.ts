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
  type AdminZohoLinkedRow,
  type AdminZohoUnlinkBody,
  type AdminZohoUnlinkResult,
  SHOP_API_ERROR_CODES,
} from "@auction/shop-contracts";
import { ShopApiError } from "../../errors/shop-api-error.js";
import type { LaxArtArtistDirectory } from "../ports/offer-on-lax-art.ports.js";
import type { StaffNameReader } from "../ports/staff-name.reader.js";
import {
  type LinkableRecord,
  type LinkedListing,
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
  staffNames: StaffNameReader;
  now?: () => Date;
};

const STAFF_PREFIX = "staff:";

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

function presentRecord({ entry, linkedTo }: LinkableRecord): AdminZohoLinkRecord {
  return {
    linkedTo,
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
    const [listings, records, block, linkedListings] = await Promise.all([
      this.deps.listings.listUnlinked(),
      this.deps.records.listLinkable(),
      this.deps.settings.blockUnlinkedPublish(),
      this.deps.listings.listLinked(),
    ]);
    const byId = new Map(records.map((record) => [record.entry.id, record]));
    const matches = matchListings(
      listings,
      records.map((record) => toMatchRecord(record.entry)),
    );
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
      // Matched means one record that is free to link. A single record that is linked elsewhere,
      // sold or held in another place needs a person to look, so it is sorted with the choices.
      const free = match.kind === "matched" && row.candidates.every((c) => c.refusal === null);
      if (free) matched.push(row);
      else if (match.kind === "none") noMatch.push(row);
      else needsChoice.push(row);
    }
    const linked = await this.linkedRows(linkedListings);
    return {
      checkedAt: this.now().toISOString(),
      counts: {
        unlinked: listings.length,
        matched: matched.length,
        needsChoice: needsChoice.length,
        noMatch: noMatch.length,
        linked: linked.length,
      },
      matched,
      needsChoice,
      noMatch,
      linked,
      blockUnlinkedPublish: block,
    };
  }

  private async linkedRows(items: readonly LinkedListing[]): Promise<AdminZohoLinkedRow[]> {
    const ids = items
      .filter((item) => item.actor.startsWith(STAFF_PREFIX))
      .map((item) => item.actor.slice(STAFF_PREFIX.length));
    const names =
      ids.length > 0 ? await this.deps.staffNames.namesFor(ids) : new Map<string, string>();
    return items.map((item) => ({
      listing: {
        artworkId: item.artworkId,
        slug: item.slug,
        title: item.title,
        artistName: item.artistName,
        published: item.published,
      },
      record: { registerId: item.registerId, stockCode: item.stockCode, title: item.recordTitle },
      linkedAt: item.linkedAt.toISOString(),
      linkedBy: item.actor.startsWith(STAFF_PREFIX)
        ? (names.get(item.actor.slice(STAFF_PREFIX.length)) ?? null)
        : null,
    }));
  }

  private async row(
    listing: UnlinkedListing,
    match: ListingMatch,
    byId: ReadonlyMap<string, LinkableRecord>,
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
        candidates.push(
          await this.candidate(listing, entry, await artistFor(entry.entry.artist.code)),
        );
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
    record: LinkableRecord,
    artist: ArtistForCode,
  ): Promise<AdminZohoLinkCandidate> {
    const { entry, linkedTo } = record;
    const plan = planLink(listing, entry, artist);
    const blockers = laxArtOfferBlockers(entry, { kind: "shop_artwork", id: listing.artworkId });
    return {
      record: presentRecord(record),
      differences: plan.differences,
      comparison: plan.comparison,
      refusal:
        linkedTo !== null
          ? `This record is already linked to ‘${linkedTo}’.`
          : (blockers[0]?.message ?? plan.artistRefusal),
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
      candidate: await this.candidate(
        listing,
        entry,
        await this.artistForCode(entry.entry.artist.code),
      ),
    };
  }

  /** Looks through the register for the record of one artwork; a record already linked says to which listing. */
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
    const free = records.filter((record) => record.linkedTo === null);
    const matches = matchListings(
      listings,
      free.map((record) => toMatchRecord(record.entry)),
    );
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
