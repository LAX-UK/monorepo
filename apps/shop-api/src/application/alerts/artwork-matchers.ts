import type {
  AccountEnableOutcome,
  AnnouncementStore,
  Clock,
  MatchLedger,
  RecordMatchService,
  SubscriberStore,
  TopicStore,
} from "@auction/alerts";
import { artworkItemKey, artworkSnapshot } from "./alert-items.js";
import type { AlertArtwork, ArtistFollowerReader } from "./alert-ports.js";

/** Turns one announced work into matches. One implementation per kind of work. */
export interface ArtworkMatcher {
  match(artwork: AlertArtwork, announce: boolean): Promise<void>;
}

/** An edition released in LAX Shop reaches everyone who asked for release alerts. */
export class ReleaseMatcher implements ArtworkMatcher {
  constructor(private readonly record: Pick<RecordMatchService, "announce">) {}

  async match(artwork: AlertArtwork, announce: boolean): Promise<void> {
    await this.record.announce({
      topic: "shop.releases",
      itemKey: artworkItemKey(artwork.id),
      snapshot: artworkSnapshot(artwork),
      announce,
    });
  }
}

const FOLLOWER_PAGE = 500;

export type FollowedArtistMatcherDeps = {
  announcements: AnnouncementStore;
  ledger: MatchLedger;
  followers: ArtistFollowerReader;
  /** Switches alerts on for a follower who has never had a row; never revives a stopped one. */
  ensureFollower: (subjectId: string) => Promise<string | null>;
  clock: Clock;
};

/**
 * An original on lax.art reaches the people who follow its artist, and only them. Followers whose
 * emails are off, stopped or unverified are skipped, so a person who turned the emails off is
 * never matched.
 */
export class FollowedArtistMatcher implements ArtworkMatcher {
  constructor(private readonly deps: FollowedArtistMatcherDeps) {}

  async match(artwork: AlertArtwork, announce: boolean): Promise<void> {
    const { announcements, ledger, followers, ensureFollower, clock } = this.deps;
    const itemKey = artworkItemKey(artwork.id);
    const now = clock.now();
    const claim = await announcements.claimItem(itemKey, announce, now);
    if (claim.expanded) return;
    if (!claim.announce) {
      await announcements.markExpanded(itemKey, now);
      return;
    }
    const snapshot = artworkSnapshot(artwork, { groupLabel: artwork.artistName });
    let after: string | null = null;
    for (;;) {
      const page = await followers.listFollowerSubjects(artwork.artistId, after, FOLLOWER_PAGE);
      if (page.length === 0) break;
      const subscriberIds: string[] = [];
      for (const subjectId of page) {
        const id = await ensureFollower(subjectId);
        if (id) subscriberIds.push(id);
      }
      await ledger.record(
        subscriberIds.map((subscriberId) => ({
          subscriberId,
          topic: "art.followed_artists" as const,
          itemKey,
          groupKey: artwork.artistId,
          snapshot,
          matchedAt: now,
        })),
      );
      after = page[page.length - 1] ?? null;
      if (page.length < FOLLOWER_PAGE) break;
    }
    await announcements.markExpanded(itemKey, now);
  }
}

/**
 * The subscriber row to match a follower against: their lax.art row when emails are on, a new one
 * when they have never had one (their address is the account's verified address), and nothing when
 * they stopped, switched the topic off or have no address.
 */
export function followerResolver(deps: {
  subscribers: Pick<SubscriberStore, "findBySubject">;
  topics: Pick<TopicStore, "list">;
  enable: (subjectId: string) => Promise<AccountEnableOutcome>;
}): (subjectId: string) => Promise<string | null> {
  const emailIsOn = async (subscriberId: string) =>
    (await deps.topics.list(subscriberId)).some(
      (s) => s.topic === "art.followed_artists" && s.emailOn,
    );
  return async (subjectId) => {
    let row = await deps.subscribers.findBySubject("art", subjectId);
    if (!row) {
      if ((await deps.enable(subjectId)) !== "enabled") return null;
      row = await deps.subscribers.findBySubject("art", subjectId);
    }
    if (!row || row.status !== "confirmed") return null;
    return (await emailIsOn(row.id)) ? row.id : null;
  };
}
