import type { Database } from "@auction/db";
import { domainEvent } from "@auction/db/schema";
import {
  UNAPPLIED_MONEY_EVENT,
  UNAPPLIED_MONEY_RESOLVED_EVENT,
  type UnappliedMoneyPayload,
} from "@auction/domain";
import { and, desc, eq, sql } from "drizzle-orm";
import type {
  IUnappliedMoneyReader,
  OpenUnappliedMoney,
} from "../interfaces/unapplied-money.reader.js";

const resolvedFor = (key: ReturnType<typeof sql>) => sql`not exists (
  select 1 from ${domainEvent} r
  where r.event_type = ${UNAPPLIED_MONEY_RESOLVED_EVENT}
    and r.payload->>'dedupeKey' = ${key}
)`;

/**
 * Unapplied money is read from the events that record it: a finance task is open from the
 * "received" event until a "resolved" event with the same key follows.
 */
export class DrizzleUnappliedMoneyReader implements IUnappliedMoneyReader {
  constructor(private readonly db: Database) {}

  async exists(dedupeKey: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: domainEvent.id })
      .from(domainEvent)
      .where(
        and(
          eq(domainEvent.eventType, UNAPPLIED_MONEY_EVENT),
          sql`${domainEvent.payload}->>'dedupeKey' = ${dedupeKey}`,
        ),
      )
      .limit(1);
    return Boolean(row);
  }

  async listOpenByChargeId(chargeId: string): Promise<OpenUnappliedMoney[]> {
    return this.listOpen({ chargeId, limit: 10 });
  }

  async listOpen(input: { limit: number; chargeId?: string }): Promise<OpenUnappliedMoney[]> {
    const rows = await this.db
      .select({
        id: domainEvent.id,
        payload: domainEvent.payload,
        occurredAt: domainEvent.occurredAt,
      })
      .from(domainEvent)
      .where(
        and(
          eq(domainEvent.eventType, UNAPPLIED_MONEY_EVENT),
          resolvedFor(sql`${domainEvent.payload}->>'dedupeKey'`),
          input.chargeId
            ? sql`${domainEvent.payload}->>'stripeChargeId' = ${input.chargeId}`
            : undefined,
        ),
      )
      .orderBy(desc(domainEvent.occurredAt))
      .limit(input.limit);
    return rows.map((row) => ({
      eventId: row.id,
      receivedAt: row.occurredAt,
      ...(row.payload as UnappliedMoneyPayload),
    }));
  }
}
