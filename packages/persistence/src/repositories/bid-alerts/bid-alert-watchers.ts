import { TOPIC_CATALOGUE } from "@auction/alerts";
import type { Database } from "@auction/db";
import {
  artistWatchlist,
  bidAlertSubscriber as s,
  savedSearch,
  bidAlertTopic as t,
} from "@auction/db/schema";
import { and, asc, eq, inArray } from "drizzle-orm";
import { type SQL, sql } from "drizzle-orm";
import type {
  ArtistWatcher,
  IBidAlertFollowerProvisioner,
  IBidAlertWatcherReader,
  SearchWatcher,
} from "../../interfaces/bid-alert-lot.js";

function searchQueryOf(raw: unknown): SearchWatcher["query"] {
  const query = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    q: typeof query.q === "string" ? query.q : "",
    categoryId: typeof query.categoryId === "string" && query.categoryId ? query.categoryId : null,
  };
}

/** People with an artist or search alert whose subscription is confirmed and the topic's email on. */
export class BidAlertWatcherReader implements IBidAlertWatcherReader {
  constructor(private readonly db: Database) {}

  async artistWatchers(artistIds: readonly string[]): Promise<ArtistWatcher[]> {
    if (artistIds.length === 0) return [];
    const rows = await this.db
      .select({
        subscriberId: s.id,
        artistId: artistWatchlist.artistId,
        medium: artistWatchlist.alertMedium,
        priceMin: artistWatchlist.alertPriceMin,
        priceMax: artistWatchlist.alertPriceMax,
      })
      .from(artistWatchlist)
      .innerJoin(s, and(eq(s.subjectId, artistWatchlist.userId), eq(s.status, "confirmed")))
      .innerJoin(t, and(eq(t.subscriberId, s.id), eq(t.topic, "bid.artists"), eq(t.emailOn, true)))
      .where(inArray(artistWatchlist.artistId, [...artistIds]))
      .orderBy(asc(s.id), asc(artistWatchlist.artistId));
    return rows.map((r) => ({
      subscriberId: r.subscriberId,
      artistId: r.artistId,
      criteria: { medium: r.medium, priceMin: r.priceMin, priceMax: r.priceMax },
    }));
  }

  async alertingSearches(): Promise<SearchWatcher[]> {
    const rows = await this.db
      .select({
        subscriberId: s.id,
        searchId: savedSearch.id,
        label: savedSearch.label,
        query: savedSearch.query,
      })
      .from(savedSearch)
      .innerJoin(s, and(eq(s.subjectId, savedSearch.userId), eq(s.status, "confirmed")))
      .innerJoin(t, and(eq(t.subscriberId, s.id), eq(t.topic, "bid.searches"), eq(t.emailOn, true)))
      .where(eq(savedSearch.notifyEmail, true))
      .orderBy(asc(savedSearch.id));
    return rows.map((r) => ({
      subscriberId: r.subscriberId,
      searchId: r.searchId,
      label: r.label,
      query: searchQueryOf(r.query),
    }));
  }
}

const NORMALISED_EMAIL = sql`lower(btrim(d.email))`;

/** Verified, live accounts: the only ones that can be switched on without a confirmation email. */
const LIVE_VERIFIED = sql`d.email_verified
  AND d.merged_into_subject_id IS NULL
  AND d.deletion_requested_at IS NULL`;

export class BidAlertFollowerProvisioner implements IBidAlertFollowerProvisioner {
  constructor(private readonly db: Database) {}

  ensureArtistFollowers(artistIds: readonly string[], now: Date): Promise<void> {
    if (artistIds.length === 0) return Promise.resolve();
    const ids = sql.join(
      artistIds.map((id) => sql`${id}::uuid`),
      sql`, `,
    );
    return this.provision(
      "bid.artists",
      "bid_follow",
      sql`SELECT d.subject_id, ${NORMALISED_EMAIL} AS email
        FROM bid_identity_directory d
        WHERE ${LIVE_VERIFIED}
          AND EXISTS (
            SELECT 1 FROM artist_watchlist w
            WHERE w.user_id = d.subject_id AND w.artist_id IN (${ids})
          )`,
      now,
    );
  }

  ensureSearchers(now: Date): Promise<void> {
    return this.provision(
      "bid.searches",
      "bid_saved_search",
      sql`SELECT d.subject_id, ${NORMALISED_EMAIL} AS email
        FROM bid_identity_directory d
        WHERE ${LIVE_VERIFIED}
          AND EXISTS (
            SELECT 1 FROM saved_search ss WHERE ss.user_id = d.subject_id AND ss.notify_email
          )`,
      now,
    );
  }

  private async provision(
    topic: "bid.artists" | "bid.searches",
    source: string,
    people: SQL,
    now: Date,
  ): Promise<void> {
    const consent = TOPIC_CATALOGUE[topic].consentText;
    await this.db.transaction(async (tx) => {
      // A person with no subscription gets a confirmed one. An address that already has a row
      // keeps it: a stopped or complaining address is never switched back on from here.
      await tx.execute(sql`
        INSERT INTO bid_alert_subscriber
          (product, email, user_id, status, consent_text, consent_source, requested_at, confirmed_at)
        SELECT 'bid', p.email, p.subject_id, 'confirmed', ${consent}, ${source}, ${now}, ${now}
        FROM (${people}) p
        WHERE NOT EXISTS (SELECT 1 FROM bid_alert_subscriber x WHERE x.user_id = p.subject_id)
        ON CONFLICT (product, email) DO NOTHING`);
      // A confirmed visitor sign-up for the same verified address is taken over by the account.
      await tx.execute(sql`
        UPDATE bid_alert_subscriber x
        SET user_id = p.subject_id, updated_at = ${now}
        FROM (${people}) p
        WHERE x.product = 'bid' AND x.email = p.email AND x.user_id IS NULL AND x.status = 'confirmed'`);
      // Only a person who never chose gets the topic: an existing row, on or off, is their choice.
      await tx.execute(sql`
        INSERT INTO bid_alert_topic (subscriber_id, topic, email_on, changed_at, changed_by)
        SELECT x.id, ${topic}, true, ${now}, 'migration'
        FROM bid_alert_subscriber x
        JOIN (${people}) p ON p.subject_id = x.user_id
        WHERE x.status = 'confirmed'
        ON CONFLICT (subscriber_id, topic) DO NOTHING`);
    });
  }
}
