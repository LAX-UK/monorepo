import type { Database } from "@auction/db";
import { domainEvent, payment } from "@auction/db/schema";
import {
  UNAPPLIED_MONEY_EVENT,
  UNAPPLIED_MONEY_RESOLVED_EVENT,
  type UnappliedMoneyPayload,
} from "@auction/domain";
import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import type {
  IUnappliedMoneyReader,
  OpenUnappliedMoney,
  OpenUnappliedMoneyFilter,
} from "../interfaces/unapplied-money.reader.js";

const resolvedFor = (key: ReturnType<typeof sql>) => sql`not exists (
  select 1 from ${domainEvent} r
  where r.event_type = ${UNAPPLIED_MONEY_RESOLVED_EVENT}
    and r.payload->>'dedupeKey' = ${key}
)`;

const field = (name: string) => sql`${domainEvent.payload}->>${name}`;

/**
 * Unapplied money is read from the events that record it: a finance task is open from the
 * "received" event until a "resolved" event with the same key follows.
 */
export class DrizzleUnappliedMoneyReader implements IUnappliedMoneyReader {
  constructor(private readonly db: Database) {}

  async exists(dedupeKey: string, tx?: Database): Promise<boolean> {
    const [row] = await (tx ?? this.db)
      .select({ id: domainEvent.id })
      .from(domainEvent)
      .where(
        and(
          eq(domainEvent.eventType, UNAPPLIED_MONEY_EVENT),
          sql`${field("dedupeKey")} = ${dedupeKey}`,
        ),
      )
      .limit(1);
    return Boolean(row);
  }

  async existsForShopPayment(
    payment: { paymentIntentId: string | null; sessionId: string },
    tx?: Database,
  ): Promise<boolean> {
    const [row] = await (tx ?? this.db)
      .select({ id: domainEvent.id })
      .from(domainEvent)
      .where(
        and(
          eq(domainEvent.eventType, UNAPPLIED_MONEY_EVENT),
          or(
            sql`${field("shopCheckoutSessionId")} = ${payment.sessionId}`,
            payment.paymentIntentId
              ? sql`${field("stripePaymentIntentId")} = ${payment.paymentIntentId}`
              : undefined,
          ),
        ),
      )
      .limit(1);
    return Boolean(row);
  }

  async listOpenByChargeId(chargeId: string): Promise<OpenUnappliedMoney[]> {
    return this.listOpen({ chargeId, limit: 10 });
  }

  async findOpen(dedupeKey: string): Promise<OpenUnappliedMoney | null> {
    const [open] = await this.listOpen({ dedupeKey, limit: 1 });
    return open ?? null;
  }

  async wasEverUnapplied(charge: {
    chargeId: string;
    paymentIntentId: string | null;
  }): Promise<boolean> {
    const [row] = await this.db
      .select({ id: domainEvent.id })
      .from(domainEvent)
      .where(
        and(
          eq(domainEvent.eventType, UNAPPLIED_MONEY_EVENT),
          or(
            sql`${field("stripeChargeId")} = ${charge.chargeId}`,
            charge.paymentIntentId
              ? sql`${field("stripePaymentIntentId")} = ${charge.paymentIntentId}`
              : undefined,
          ),
        ),
      )
      .limit(1);
    return Boolean(row);
  }

  async lockKey(tx: Database, dedupeKey: string): Promise<void> {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`unapplied:${dedupeKey}`}))`);
  }

  async isChargeOfPaidInvoice(charge: {
    chargeId: string;
    paymentIntentId: string | null;
  }): Promise<boolean> {
    // The same rule as the refund handler's invoice match: the invoice's recorded charge, or,
    // when it recorded no charge, its recorded payment intent.
    const [row] = await this.db
      .select({ id: payment.id })
      .from(payment)
      .where(
        and(
          inArray(payment.status, ["captured", "refunded"]),
          or(
            eq(payment.stripeChargeId, charge.chargeId),
            charge.paymentIntentId
              ? and(
                  isNull(payment.stripeChargeId),
                  eq(payment.stripePaymentIntentId, charge.paymentIntentId),
                )
              : undefined,
          ),
        ),
      )
      .limit(1);
    return Boolean(row);
  }

  async listOpen(
    input: OpenUnappliedMoneyFilter & { limit: number },
    tx?: Database,
  ): Promise<OpenUnappliedMoney[]> {
    const money =
      input.paymentIntentId || input.chargeId
        ? or(
            input.paymentIntentId
              ? sql`${field("stripePaymentIntentId")} = ${input.paymentIntentId}`
              : undefined,
            input.chargeId ? sql`${field("stripeChargeId")} = ${input.chargeId}` : undefined,
          )
        : undefined;
    const rows = await (tx ?? this.db)
      .select({
        id: domainEvent.id,
        payload: domainEvent.payload,
        occurredAt: domainEvent.occurredAt,
      })
      .from(domainEvent)
      .where(
        and(
          eq(domainEvent.eventType, UNAPPLIED_MONEY_EVENT),
          resolvedFor(field("dedupeKey")),
          money,
          input.reasons?.length
            ? sql`${field("reason")} in (${sql.join(
                input.reasons.map((r) => sql`${r}`),
                sql`, `,
              )})`
            : undefined,
          input.excludeReasons?.length
            ? sql`${field("reason")} not in (${sql.join(
                input.excludeReasons.map((r) => sql`${r}`),
                sql`, `,
              )})`
            : undefined,
          input.dedupeKey ? sql`${field("dedupeKey")} = ${input.dedupeKey}` : undefined,
          input.stripeCustomerId
            ? sql`${field("stripeCustomerId")} = ${input.stripeCustomerId}`
            : undefined,
          input.currency
            ? sql`upper(${field("currency")}) = ${input.currency.toUpperCase()}`
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
