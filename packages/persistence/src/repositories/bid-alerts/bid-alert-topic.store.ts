import type { AlertTopic, TopicChangedBy, TopicRecipient, TopicStore } from "@auction/alerts";
import type { Database } from "@auction/db";
import { bidAlertSubscriber as s, bidAlertTopic as t } from "@auction/db/schema";
import { and, asc, eq, gt } from "drizzle-orm";

export class BidAlertTopicStore implements TopicStore {
  constructor(private readonly db: Database) {}

  async list(subscriberId: string) {
    const rows = await this.db
      .select({ topic: t.topic, emailOn: t.emailOn })
      .from(t)
      .where(eq(t.subscriberId, subscriberId))
      .orderBy(asc(t.topic));
    return rows as { topic: AlertTopic; emailOn: boolean }[];
  }

  async setEmail(
    subscriberId: string,
    topic: AlertTopic,
    on: boolean,
    by: TopicChangedBy,
    now: Date,
  ) {
    await this.db
      .insert(t)
      .values({ subscriberId, topic, emailOn: on, changedAt: now, changedBy: by })
      .onConflictDoUpdate({
        target: [t.subscriberId, t.topic],
        set: { emailOn: on, changedAt: now, changedBy: by },
      });
  }

  async listEmailRecipients(
    topic: AlertTopic,
    after: string | null,
    limit: number,
  ): Promise<TopicRecipient[]> {
    const rows = await this.db
      .select({ subscriberId: t.subscriberId })
      .from(t)
      .innerJoin(s, eq(s.id, t.subscriberId))
      .where(
        and(
          eq(t.topic, topic),
          eq(t.emailOn, true),
          eq(s.status, "confirmed"),
          after ? gt(t.subscriberId, after) : undefined,
        ),
      )
      .orderBy(asc(t.subscriberId))
      .limit(limit);
    return rows;
  }
}
