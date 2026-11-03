import type { Database } from "@auction/db";
import { domainEvent } from "@auction/db/schema";
import { and, desc, eq } from "drizzle-orm";
import type { BlockedCapture } from "../interfaces/payment-write.repository.js";

/** Event the Stripe webhook records when money arrives for a payment that was already closed. */
export const BLOCKED_CAPTURE_EVENT = "payment.capture_blocked_terminal_status";

type Payload = {
  stripePaymentIntentId?: unknown;
  stripeChargeId?: unknown;
  amountCents?: unknown;
};

const text = (value: unknown) => (typeof value === "string" && value !== "" ? value : null);

export function toBlockedCapture(row: {
  aggregateId: string;
  payload: unknown;
  occurredAt: Date;
}): BlockedCapture {
  const payload = (row.payload ?? {}) as Payload;
  return {
    paymentId: row.aggregateId,
    stripePaymentIntentId: text(payload.stripePaymentIntentId),
    stripeChargeId: text(payload.stripeChargeId),
    amountCents: typeof payload.amountCents === "number" ? payload.amountCents : 0,
    blockedAt: row.occurredAt,
  };
}

export async function findBlockedCaptureEvent(
  db: Database,
  paymentId: string,
): Promise<BlockedCapture | null> {
  const [row] = await db
    .select({
      aggregateId: domainEvent.aggregateId,
      payload: domainEvent.payload,
      occurredAt: domainEvent.occurredAt,
    })
    .from(domainEvent)
    .where(
      and(
        eq(domainEvent.aggregateType, "payment"),
        eq(domainEvent.aggregateId, paymentId),
        eq(domainEvent.eventType, BLOCKED_CAPTURE_EVENT),
      ),
    )
    .orderBy(desc(domainEvent.occurredAt))
    .limit(1);
  return row ? toBlockedCapture(row) : null;
}
