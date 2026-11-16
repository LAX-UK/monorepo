import type { AlertTopic, InAppTopicLookup } from "@auction/alerts";
import type { Database } from "@auction/db";
import { notification, notificationPreference } from "@auction/db/schema";
import { eq, sql } from "drizzle-orm";
import type {
  BidAlertLotNotice,
  IBidAlertLotNoticeWriter,
} from "../../interfaces/bid-alert-lot-notice.js";

/** The app switch each notice type follows. */
const SWITCH_BY_TYPE: Record<
  BidAlertLotNotice["type"],
  "artist_alerts_in_app" | "search_alerts_in_app"
> = {
  artist_lots_listed: "artist_alerts_in_app",
  search_lots_listed: "search_alerts_in_app",
};

/**
 * The in-app notices for new lots, one per person, digest and type. A digest is one person's one
 * London day, so this is one notice per person per day however many lots matched. The unique key
 * on the digest and type makes a repeat a no-op, and a person with the app switch off gets none.
 */
export class BidAlertLotNoticeWriter implements IBidAlertLotNoticeWriter {
  constructor(private readonly db: Database) {}

  async write(input: {
    digestId: string;
    userId: string;
    notices: readonly BidAlertLotNotice[];
  }): Promise<number> {
    let written = 0;
    for (const notice of input.notices) {
      const switchColumn = sql.raw(`p.${SWITCH_BY_TYPE[notice.type]}`);
      const result = await this.db.execute(sql`
        INSERT INTO ${notification} (user_id, type, title, message, link_path, alert_digest_id)
        SELECT ${input.userId}, ${notice.type}, ${notice.title}, ${notice.message},
               ${notice.linkPath}, ${input.digestId}::uuid
        WHERE COALESCE(
          (SELECT ${switchColumn} FROM ${notificationPreference} p WHERE p.user_id = ${input.userId}),
          true
        )
        ON CONFLICT (alert_digest_id, type) WHERE alert_digest_id IS NOT NULL DO NOTHING
      `);
      written += result.rowCount ?? 0;
    }
    return written;
  }
}

/** The topics a signed-in person keeps on in the app: the app switches default to on. */
export class BidAlertInAppTopics implements InAppTopicLookup {
  constructor(private readonly db: Database) {}

  async topicsOn(subjectId: string): Promise<readonly AlertTopic[]> {
    const [row] = await this.db
      .select({
        artists: notificationPreference.artistAlertsInApp,
        searches: notificationPreference.searchAlertsInApp,
      })
      .from(notificationPreference)
      .where(eq(notificationPreference.userId, subjectId))
      .limit(1);
    const topics: AlertTopic[] = [];
    if (row?.artists ?? true) topics.push("bid.artists");
    if (row?.searches ?? true) topics.push("bid.searches");
    return topics;
  }
}
