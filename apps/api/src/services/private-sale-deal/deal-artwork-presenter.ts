import {
  type ArtworkRegisterEntry,
  deriveWhereItIs,
  offerMovesOf,
  withdrawalOf,
} from "@auction/artwork-register-contracts";
import type {
  IArtworkRegisterReader,
  IOpenLotPlaceReader,
  OpenLotPlace,
} from "@auction/persistence/interfaces";
import type { DealArtworkOption } from "@auction/validators";

/** How much of an artwork's history is read to tell when a withdrawn artwork was withdrawn. */
const HISTORY_EVENTS = 200;

/** What staff need to recognise an artwork and see where it is. */
export type DealArtworkSummary = Pick<
  DealArtworkOption,
  | "id"
  | "title"
  | "artist"
  | "medium"
  | "size"
  | "stockCode"
  | "catalogueStatus"
  | "thumbnailUrl"
  | "whereItIs"
> & {
  /** The sale a linked draft lot belongs to; `null` when no draft lot is linked. */
  draftLot: { saleName: string | null } | null;
};

export type PresentedArtwork = {
  summary: DealArtworkSummary;
  /** The lot holding the artwork's place in LAX Bid, if any. */
  place: OpenLotPlace | undefined;
};

export type DealArtworkPresenterDeps = {
  register: Pick<IArtworkRegisterReader, "listEvents">;
  places: IOpenLotPlaceReader;
  media: { resolveManyUnique(keys: readonly string[]): Promise<Map<string, string>> };
  now?: () => Date;
};

/**
 * Draws register artworks the way every deal screen does: the picture, the words that tell it from
 * its neighbours, and where it is, worked out by the register's own rule so the picker, the deal
 * page and the artwork's own page always agree.
 */
export class DealArtworkPresenter {
  constructor(private readonly deps: DealArtworkPresenterDeps) {}

  async present(entries: readonly ArtworkRegisterEntry[]): Promise<Map<string, PresentedArtwork>> {
    if (entries.length === 0) return new Map();
    const now = (this.deps.now ?? (() => new Date()))();
    const [places, thumbnails, withdrawals] = await Promise.all([
      this.deps.places.listOpenLotPlaces(entries.map((entry) => entry.id)),
      this.thumbnails(entries),
      this.withdrawals(entries),
    ]);
    const placeOf = new Map(places.map((place) => [place.registerId, place]));
    return new Map(
      entries.map((entry) => {
        const place = placeOf.get(entry.id);
        const whereItIs = deriveWhereItIs({
          offer: entry.offer,
          now,
          withdrawn: withdrawals.get(entry.id) ?? null,
          hasBidDraftLot: place?.status === "draft",
        });
        const summary: DealArtworkSummary = {
          id: entry.id,
          title: entry.title,
          artist: entry.artist.name,
          medium: entry.medium,
          size: entry.dimensions,
          stockCode: entry.stockCode,
          catalogueStatus: entry.catalogueStatus,
          thumbnailUrl: thumbnails.get(entry.id) ?? null,
          whereItIs: { key: whereItIs.key, chip: whereItIs.chip },
          draftLot:
            whereItIs.key === "draft_bid_lot" ? { saleName: place?.saleTitle ?? null } : null,
        };
        return [entry.id, { summary, place }] as const;
      }),
    );
  }

  private async thumbnails(entries: readonly ArtworkRegisterEntry[]): Promise<Map<string, string>> {
    const covers = entries.flatMap((entry) =>
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
  private async withdrawals(entries: readonly ArtworkRegisterEntry[]) {
    const withdrawn = entries.filter((entry) => entry.offer.state === "withdrawn");
    const found = await Promise.all(
      withdrawn.map(async (entry) => {
        const events = await this.deps.register.listEvents(entry.id, HISTORY_EVENTS);
        return [entry.id, withdrawalOf(offerMovesOf(events), entry.offer.state)] as const;
      }),
    );
    return new Map(found);
  }
}
