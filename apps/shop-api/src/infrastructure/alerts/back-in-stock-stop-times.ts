import type { Database } from "@auction/db";
import { shopAlertSubscriber as s, shopAlertTopic as t } from "@auction/db/schema";
import { and, eq } from "drizzle-orm";
import { BACK_IN_STOCK_TOPIC, type BackInStockStopTimes } from "./back-in-stock-links.js";

/** A stopped row with no recorded time (never written that way) covers every request. */
const ALWAYS = new Date(8.64e15);

/** Reads when a subscriber stopped Shop alerts, or switched back in stock off, from the engine's tables. */
export class ShopBackInStockStopTimes implements BackInStockStopTimes {
  constructor(private readonly db: Database) {}

  async stoppedSince(subscriberId: string): Promise<Date | null> {
    const [row] = await this.db
      .select({
        status: s.status,
        stoppedAt: s.stoppedAt,
        topicOn: t.emailOn,
        topicChangedAt: t.changedAt,
      })
      .from(s)
      .leftJoin(t, and(eq(t.subscriberId, s.id), eq(t.topic, BACK_IN_STOCK_TOPIC)))
      .where(eq(s.id, subscriberId))
      .limit(1);
    if (!row) return null;
    const times: Date[] = [];
    if (row.status === "stopped") times.push(row.stoppedAt ?? ALWAYS);
    if (row.topicOn === false && row.topicChangedAt) times.push(row.topicChangedAt);
    if (times.length === 0) return null;
    return new Date(Math.max(...times.map((d) => d.getTime())));
  }
}
