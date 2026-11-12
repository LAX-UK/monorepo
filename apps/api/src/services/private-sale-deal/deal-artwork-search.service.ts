import {
  type ArtworkRegisterEntry,
  type OfferPlaceDetail,
  type OfferPlaceRef,
  checkOfferable,
  deriveWhereItIs,
  offerMovesOf,
  offerRefusal,
  withdrawalOf,
} from "@auction/artwork-register-contracts";
import { canViewEnquiry } from "@auction/domain";
import type {
  IArtworkRegisterReader,
  IDealArtworkSearchReader,
  IDealWorkStore,
  ILotRegisterLinkReader,
  IMarketingEnquiryRepository,
  IOpenLotPlaceReader,
  OpenLotPlace,
} from "@auction/persistence/interfaces";
import type {
  AdminDealArtworkSearchQuery,
  DealArtworkLock,
  DealArtworkOption,
} from "@auction/validators";
import type {
  DealArtworkSearchOutcome,
  IDealArtworkSearch,
} from "../interfaces/private-sale-deal-desk.js";

/** Enough matches to put the artworks that can be held first, without reading the whole register. */
export const ARTWORK_SEARCH_CANDIDATES = 200;

/** How much of an artwork's history is read to tell when a withdrawn artwork was withdrawn. */
const HISTORY_EVENTS = 200;

/**
 * Asked of the register as if a new deal wanted the artwork. No deal exists yet, so no place
 * matches this one: an artwork already in any private sale is refused, as it is at conversion.
 */
const NEW_DEAL_PLACE: OfferPlaceRef = { kind: "private_sale", id: "new-deal" };

export type DealArtworkSearchDeps = {
  register: Pick<IArtworkRegisterReader, "findById" | "listEvents">;
  search: IDealArtworkSearchReader;
  places: IOpenLotPlaceReader;
  /** The register artwork a Bid lot offered. */
  lots: ILotRegisterLinkReader;
  enquiries: Pick<IMarketingEnquiryRepository, "findByRef">;
  works: Pick<IDealWorkStore, "findByReference">;
  media: { resolveManyUnique(keys: readonly string[]): Promise<Map<string, string>> };
  now?: () => Date;
};

type Candidate = {
  entry: ArtworkRegisterEntry;
  /** Why the register would refuse it, before the sale and lot are known. */
  refusal: ReturnType<typeof refusalFor>;
  suggested: boolean;
};

function refusalFor(entry: ArtworkRegisterEntry) {
  const check = checkOfferable(entry, NEW_DEAL_PLACE);
  return check.ok ? null : check.error;
}

function placeDetail(place: OpenLotPlace | undefined): OfferPlaceDetail | undefined {
  return place ? { saleName: place.saleTitle, lotNumber: place.lotNumber } : undefined;
}

/**
 * The artworks a deal can be made for. Originals only; each says where it is, and whether the
 * register would hold it for a new deal, using the same check the register runs when the deal
 * opens, and the same words when it would not. Artworks that can be held come first.
 */
export class DealArtworkSearchService implements IDealArtworkSearch {
  constructor(private readonly deps: DealArtworkSearchDeps) {}

  async search(
    viewer: { userId: string; readsPrivateSale: boolean },
    query: AdminDealArtworkSearchQuery,
  ): Promise<DealArtworkSearchOutcome> {
    const suggest = await this.suggestionFor(viewer, query.enquiry);
    if (suggest === "not_found") return { ok: false, error: "enquiry_not_found" };

    // Typed text narrows the list to what was asked for; only an empty box starts from the enquiry.
    const useSuggestion = query.q === "" && suggest !== null;
    const entries = await this.deps.search.searchOriginals({
      text: query.q,
      suggest: useSuggestion ? suggest : undefined,
      limit: ARTWORK_SEARCH_CANDIDATES,
    });
    const candidates = entries.map((entry) => ({
      entry,
      refusal: refusalFor(entry),
      suggested: useSuggestion && this.matches(entry, suggest),
    }));
    // A stable partition: the register's order (suggestions, then title) holds inside each half.
    const ordered = [
      ...candidates.filter((c) => c.refusal === null),
      ...candidates.filter((c) => c.refusal !== null),
    ];
    const page = ordered.slice(0, query.limit);

    const preselected = await this.earlierLotCandidate(query.work, candidates);
    const extra = preselected && !page.includes(preselected) ? [preselected] : [];
    const options = new Map(
      (await this.present([...page, ...extra])).map((option) => [option.id, option]),
    );
    const optionOf = (candidate: Candidate): DealArtworkOption =>
      options.get(candidate.entry.id) as DealArtworkOption;
    return {
      ok: true,
      result: {
        items: page.map(optionOf),
        hasMore: ordered.length > query.limit || entries.length >= ARTWORK_SEARCH_CANDIDATES,
        preselected: preselected ? optionOf(preselected) : null,
      },
    };
  }

  /** What the enquiry describes, `null` when it names nothing, or `"not_found"` when it cannot be seen. */
  private async suggestionFor(
    viewer: { userId: string; readsPrivateSale: boolean },
    enquiryRef: string | undefined,
  ): Promise<{ artist: string | null; title: string | null } | null | "not_found"> {
    if (!enquiryRef) return null;
    const enquiry = await this.deps.enquiries.findByRef(enquiryRef);
    if (!enquiry || !canViewEnquiry(enquiry, { ...viewer, readsGeneral: false })) {
      return "not_found";
    }
    const artist = enquiry.privateSale?.artist?.trim() || null;
    const title = enquiry.privateSale?.title?.trim() || null;
    return artist || title ? { artist, title } : null;
  }

  private matches(
    entry: ArtworkRegisterEntry,
    suggest: { artist: string | null; title: string | null } | null,
  ): boolean {
    const has = (text: string, part: string | null) =>
      part !== null && text.toLowerCase().includes(part.toLowerCase());
    return (
      has(entry.artist.name, suggest?.artist ?? null) || has(entry.title, suggest?.title ?? null)
    );
  }

  /** The artwork the consignment's earlier lot offered, when the register knows it and it is an original. */
  private async earlierLotCandidate(
    workReference: string | undefined,
    found: readonly Candidate[],
  ): Promise<Candidate | null> {
    if (!workReference) return null;
    const work = await this.deps.works.findByReference(workReference);
    if (!work?.convertedLotId) return null;
    const link = await this.deps.lots.findLink(work.convertedLotId);
    if (!link) return null;
    const known = found.find((c) => c.entry.id === link.registerId);
    if (known) return known;
    const entry = await this.deps.register.findById(link.registerId);
    if (entry?.kind !== "original") return null;
    return { entry, refusal: refusalFor(entry), suggested: false };
  }

  private async present(candidates: readonly Candidate[]): Promise<DealArtworkOption[]> {
    const now = (this.deps.now ?? (() => new Date()))();
    const [places, thumbnails, histories] = await Promise.all([
      this.deps.places.listOpenLotPlaces(candidates.map((c) => c.entry.id)),
      this.thumbnails(candidates),
      this.withdrawals(candidates),
    ]);
    const placeOf = new Map(places.map((place) => [place.registerId, place]));
    return candidates.map(({ entry, refusal, suggested }) => {
      const place = placeOf.get(entry.id);
      const whereItIs = deriveWhereItIs({
        offer: entry.offer,
        now,
        withdrawn: histories.get(entry.id) ?? null,
        hasBidDraftLot: place?.status === "draft",
      });
      // The sale and lot make the refusal say where; without them it says what the register says.
      const lock: DealArtworkLock | undefined = refusal
        ? offerRefusal(refusal.reason, refusal.state, placeDetail(place))
        : undefined;
      return {
        id: entry.id,
        title: entry.title,
        artist: entry.artist.name,
        medium: entry.medium,
        size: entry.dimensions,
        stockCode: entry.stockCode,
        catalogueStatus: entry.catalogueStatus,
        thumbnailUrl: thumbnails.get(entry.id) ?? null,
        whereItIs: { key: whereItIs.key, chip: whereItIs.chip },
        available: refusal === null,
        ...(lock ? { lock } : {}),
        suggested,
      };
    });
  }

  private async thumbnails(candidates: readonly Candidate[]): Promise<Map<string, string>> {
    const covers = candidates.flatMap(({ entry }) =>
      entry.imageRefs[0] ? [{ id: entry.id, ref: entry.imageRefs[0] }] : [],
    );
    if (covers.length === 0) return new Map();
    const resolved = await this.deps.media.resolveManyUnique(covers.map((c) => c.ref));
    return new Map(
      covers.flatMap(({ id, ref }) => {
        const url = resolved.get(ref);
        return url ? [[id, url] as const] : [];
      }),
    );
  }

  /** When a withdrawn artwork was withdrawn, so its chip reads the same here as on its own page. */
  private async withdrawals(candidates: readonly Candidate[]) {
    const withdrawn = candidates.filter((c) => c.entry.offer.state === "withdrawn");
    const found = await Promise.all(
      withdrawn.map(async ({ entry }) => {
        const events = await this.deps.register.listEvents(entry.id, HISTORY_EVENTS);
        return [entry.id, withdrawalOf(offerMovesOf(events), entry.offer.state)] as const;
      }),
    );
    return new Map(found);
  }
}
