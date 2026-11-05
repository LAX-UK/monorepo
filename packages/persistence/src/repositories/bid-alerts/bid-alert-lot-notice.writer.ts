import type { Database } from "@auction/db";
import { notification, notificationPreference } from "@auction/db/schema";
import { sql } from "drizzle-orm";
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
