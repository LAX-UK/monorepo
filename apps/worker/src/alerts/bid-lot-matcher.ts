import type { MatchLedger, NewMatch } from "@auction/alerts";
import { lotMatchesArtistAlert } from "@auction/domain";
import type {
  AlertableLot,
  IBidAlertFollowerProvisioner,
  IBidAlertLotReader,
  IBidAlertWatcherReader,
  SearchWatcher,
} from "@auction/persistence/interfaces";
import type { LotPublishedEvent } from "../projectors/lib/bid-alert-matching.types.js";
import { artistCriteriaLine, lotSnapshot } from "./lot-snapshot.js";

export type LotMatchOutcome = { lots: number; artistMatches: number; searchMatches: number };

/**
 * Followed-artist and saved-search matchers. For a batch of published lots it records one match
 * per person and lot in the ledger; the 08:00 digest sends them. A lot reaches a person once:
 * when a followed artist and a saved search both match it, the artist match is the one kept, and
 * of two saved searches the one with the lower id.
 */
export class BidLotMatcher {
  constructor(
    private readonly deps: {
      lots: IBidAlertLotReader;
      watchers: IBidAlertWatcherReader;
      provisioner: IBidAlertFollowerProvisioner;
      matches: Pick<MatchLedger, "record">;
      clock: { now(): Date };
    },
  ) {}

  async handle(events: readonly LotPublishedEvent[]): Promise<LotMatchOutcome> {
    const ids = [...new Set(events.map((e) => e.lotId))];
    const lots = await this.deps.lots.findAlertable(ids);
    if (lots.length === 0) return { lots: 0, artistMatches: 0, searchMatches: 0 };
    const now = this.deps.clock.now();

    const artistMatches = await this.artistMatches(lots, now);
    const taken = new Set(artistMatches.map((m) => `${m.subscriberId}|${m.itemKey}`));
    const searchMatches = await this.searchMatches(lots, taken, now);

    await this.deps.matches.record([...artistMatches, ...searchMatches]);
    return {
      lots: lots.length,
      artistMatches: artistMatches.length,
      searchMatches: searchMatches.length,
    };
  }

  private async artistMatches(lots: readonly AlertableLot[], now: Date): Promise<NewMatch[]> {
    const byArtist = new Map<string, AlertableLot[]>();
    for (const lot of lots) {
      if (!lot.artistId) continue;
      byArtist.set(lot.artistId, [...(byArtist.get(lot.artistId) ?? []), lot]);
    }
    if (byArtist.size === 0) return [];
    const artistIds = [...byArtist.keys()];
    await this.deps.provisioner.ensureArtistFollowers(artistIds, now);
    const out: NewMatch[] = [];
    for (const watcher of await this.deps.watchers.artistWatchers(artistIds)) {
      for (const lot of byArtist.get(watcher.artistId) ?? []) {
        if (!lotMatchesArtistAlert(watcher.criteria, { medium: lot.medium, price: lot.price })) {
          continue;
        }
        out.push({
          subscriberId: watcher.subscriberId,
          topic: "bid.artists",
          itemKey: `lot:${lot.id}`,
          groupKey: watcher.artistId,
          snapshot: lotSnapshot(lot, {
            label: lot.artistName ?? "An artist you follow",
            criteria: artistCriteriaLine(watcher.criteria),
          }),
          matchedAt: now,
        });
      }
    }
    return out;
  }

  private async searchMatches(
    lots: readonly AlertableLot[],
    taken: Set<string>,
    now: Date,
  ): Promise<NewMatch[]> {
    await this.deps.provisioner.ensureSearchers(now);
    const searches = await this.deps.watchers.alertingSearches();
    if (searches.length === 0) return [];
    const lotById = new Map(lots.map((lot) => [lot.id, lot]));
    const lotIds = [...lotById.keys()];
    // One query per distinct search text and category, however many people saved it.
    const hits = new Map<string, ReadonlySet<string>>();
    const hitsFor = async (query: SearchWatcher["query"]) => {
      const key = JSON.stringify([query.q.trim().toLowerCase(), query.categoryId]);
      let found = hits.get(key);
      if (!found) {
        found = await this.deps.lots.matchingSearch(query, lotIds);
        hits.set(key, found);
      }
      return found;
    };
    const out: NewMatch[] = [];
    for (const search of searches) {
      for (const lotId of await hitsFor(search.query)) {
        const lot = lotById.get(lotId);
        const pair = `${search.subscriberId}|lot:${lotId}`;
        if (!lot || taken.has(pair)) continue;
        taken.add(pair);
        out.push({
          subscriberId: search.subscriberId,
          topic: "bid.searches",
          itemKey: `lot:${lotId}`,
          groupKey: search.searchId,
          snapshot: lotSnapshot(lot, { label: search.label }),
          matchedAt: now,
        });
      }
    }
    return out;
  }
}
