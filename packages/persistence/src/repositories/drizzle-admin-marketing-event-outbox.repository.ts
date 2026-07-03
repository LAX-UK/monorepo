import type { Database } from "@auction/db";
import { marketingEventOutbox } from "@auction/db/schema";
import { and, asc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import type {
  IAdminMarketingEventOutboxRepository,
  MarketingEventOutboxState,
} from "../interfaces/admin-marketing-event-outbox.repository.js";

export class DrizzleAdminMarketingEventOutboxRepository
  implements IAdminMarketingEventOutboxRepository
{
  constructor(private readonly db: Database) {}

  async countReplayCandidates(input: {
    from: Date;
    to: Date;
    states: MarketingEventOutboxState[];
    names?: string[] | undefined;
  }): Promise<number> {
    const conditions = this.replayConditions(input);
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(marketingEventOutbox)
      .where(and(...conditions));
    return row?.count ?? 0;
  }

  async listReplayCandidateIds(input: {
    from: Date;
    to: Date;
    states: MarketingEventOutboxState[];
    names?: string[] | undefined;
    limit: number;
  }): Promise<string[]> {
    const conditions = this.replayConditions(input);
    const rows = await this.db
      .select({ id: marketingEventOutbox.id })
      .from(marketingEventOutbox)
      .where(and(...conditions))
      .orderBy(asc(marketingEventOutbox.createdAt))
      .limit(input.limit);
    return rows.map((row) => row.id);
  }

  async requeueByIds(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    const updated = await this.db
      .update(marketingEventOutbox)
      .set({ state: "pending", attempts: 0, lastError: null, sentAt: null, claimedAt: null })
      .where(inArray(marketingEventOutbox.id, ids))
      .returning({ id: marketingEventOutbox.id });
    return updated.length;
  }

  async statsSince(since: Date) {
    return this.db
      .select({
        name: marketingEventOutbox.name,
        state: marketingEventOutbox.state,
        count: sql<number>`count(*)::int`,
      })
      .from(marketingEventOutbox)
      .where(gte(marketingEventOutbox.createdAt, since))
      .groupBy(marketingEventOutbox.name, marketingEventOutbox.state);
  }

  async failedLastHour(windowMs: number) {
    return this.db
      .select({
        name: marketingEventOutbox.name,
        count: sql<number>`count(*)::int`,
      })
      .from(marketingEventOutbox)
      .where(
        and(
          eq(marketingEventOutbox.state, "failed"),
          gte(marketingEventOutbox.createdAt, new Date(Date.now() - windowMs)),
        ),
      )
      .groupBy(marketingEventOutbox.name);
  }

  private replayConditions(input: {
    from: Date;
    to: Date;
    states: MarketingEventOutboxState[];
    names?: string[] | undefined;
  }) {
    const conditions = [
      gte(marketingEventOutbox.createdAt, input.from),
      lte(marketingEventOutbox.createdAt, input.to),
      inArray(marketingEventOutbox.state, [...input.states]),
    ];
    if (input.names?.length) {
      conditions.push(inArray(marketingEventOutbox.name, input.names));
    }
    return conditions;
  }
}
