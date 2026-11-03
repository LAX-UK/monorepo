import type { MatchSnapshot } from "../domain/match.js";
import type { AlertTopic } from "../domain/products.js";
import type { AnnouncementStore, Clock, MatchLedger, TopicStore } from "../ports.js";

const PAGE_SIZE = 500;

export type AnnounceInput = {
  topic: AlertTopic;
  /** `sale:<id>`: an item is announced once, whatever happens to it later. */
  itemKey: string;
  groupKey?: string | null;
  snapshot: MatchSnapshot;
  /** False marks the item announced without telling anyone (a test or private sale). */
  announce: boolean;
};

export type AnnounceResult = { first: boolean; announced: boolean; matches: number };

/**
 * Records that an item should reach everyone subscribed to a topic. It only writes matches to the
 * ledger, so publishing never sends mail and a large publish stays fast.
 */
export class RecordMatchService {
  constructor(
    private readonly deps: {
      topics: TopicStore;
      ledger: MatchLedger;
      announcements: AnnouncementStore;
      clock: Clock;
    },
  ) {}

  async announce(input: AnnounceInput): Promise<AnnounceResult> {
    const now = this.deps.clock.now();
    const claim = await this.deps.announcements.claimItem(input.itemKey, input.announce, now);
    // An item that was claimed but not finished (a crash part-way) is finished here: recording
    // a match is idempotent, so doing the work again never doubles anything.
    if (claim.expanded) return { first: false, announced: false, matches: 0 };
    if (!claim.announce) {
      await this.deps.announcements.markExpanded(input.itemKey, now);
      return { first: claim.first, announced: false, matches: 0 };
    }
    let matches = 0;
    let after: string | null = null;
    for (;;) {
      const page = await this.deps.topics.listEmailRecipients(input.topic, after, PAGE_SIZE);
      if (page.length === 0) break;
      matches += await this.deps.ledger.record(
        page.map((recipient) => ({
          subscriberId: recipient.subscriberId,
          topic: input.topic,
          itemKey: input.itemKey,
          groupKey: input.groupKey ?? null,
          snapshot: input.snapshot,
          matchedAt: now,
        })),
      );
      after = page[page.length - 1]?.subscriberId ?? null;
      if (page.length < PAGE_SIZE) break;
    }
    await this.deps.announcements.markExpanded(input.itemKey, now);
    return { first: claim.first, announced: true, matches };
  }
}
