import { artworkIdOfItemKey } from "./alert-items.js";
import type { AlertArtwork, AlertArtworkReader, AnnouncementQueue } from "./alert-ports.js";
import type { ArtworkMatcher } from "./artwork-matchers.js";

const BATCH = 50;

export type AlertMatchingStats = { handled: number; skipped: number; failed: number };

/** One matcher per kind of work: a new kind of alert adds an entry here and nothing else. */
export type ArtworkMatchers = Readonly<Record<AlertArtwork["kind"], ArtworkMatcher>>;

type MatchingLogger = { warn(fields: Record<string, unknown>, message: string): void };

/**
 * Turns published works into matches. Publishing only records an announcement; this runs outside
 * that transaction, so a large publish stays fast and a failure here never undoes a publish. It
 * only writes matches: the daily digest does the sending.
 */
export class AlertMatchingService {
  constructor(
    private readonly deps: {
      queue: AnnouncementQueue;
      artworks: AlertArtworkReader;
      matchers: ArtworkMatchers;
      log: MatchingLogger;
    },
  ) {}

  async run(): Promise<AlertMatchingStats> {
    const stats: AlertMatchingStats = { handled: 0, skipped: 0, failed: 0 };
    for (const item of await this.deps.queue.listUnexpanded(BATCH)) {
      const artworkId = artworkIdOfItemKey(item.itemKey);
      const artwork = artworkId ? await this.deps.artworks.find(artworkId) : null;
      if (!artwork || !artwork.published) {
        stats.skipped += 1;
        continue;
      }
      try {
        await this.deps.matchers[artwork.kind].match(artwork, item.announce);
        stats.handled += 1;
      } catch (err) {
        stats.failed += 1;
        this.deps.log.warn({ err, itemKey: item.itemKey }, "alert matching failed for one work");
      }
    }
    return stats;
  }
}
