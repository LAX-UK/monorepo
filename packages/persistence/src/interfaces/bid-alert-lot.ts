import type { ArtistAlertCriteria } from "@auction/domain";

/** A published lot, as far as an artist or saved-search alert needs it. */
export type AlertableLot = {
  id: string;
  title: string;
  medium: string | null;
  artistId: string | null;
  artistName: string | null;
  saleTitle: string | null;
  /** The figure artist alerts compare a price range with: the low estimate, else the start price. */
  price: string;
  /** Present when the lot carries an estimate; the email shows it instead of the start price. */
  estimate: { low: string; high: string; currency: string } | null;
  startingPrice: string;
};

export type ArtistWatcher = {
  subscriberId: string;
  artistId: string;
  criteria: ArtistAlertCriteria;
};

export type SearchWatcher = {
  subscriberId: string;
  searchId: string;
  label: string;
  query: { q: string; categoryId: string | null };
};

/** Lots that may be announced: on sale now or scheduled, in a sale the public can see. */
export interface IBidAlertLotReader {
  findAlertable(lotIds: readonly string[]): Promise<AlertableLot[]>;
  /** Of these lots, the ones the public search page would show for this query. */
  matchingSearch(
    query: SearchWatcher["query"],
    lotIds: readonly string[],
  ): Promise<ReadonlySet<string>>;
}

/** Who asked to hear about artists and searches, with email on for the topic. */
export interface IBidAlertWatcherReader {
  artistWatchers(artistIds: readonly string[]): Promise<ArtistWatcher[]>;
  alertingSearches(): Promise<SearchWatcher[]>;
}

/**
 * Following an artist, or saving a search with email on, is the request for these alerts. A
 * verified account that has never chosen is given the topic; anyone who stopped, or switched the
 * topic off, is left as they chose.
 */
export interface IBidAlertFollowerProvisioner {
  ensureArtistFollowers(artistIds: readonly string[], now: Date): Promise<void>;
  ensureSearchers(now: Date): Promise<void>;
}
