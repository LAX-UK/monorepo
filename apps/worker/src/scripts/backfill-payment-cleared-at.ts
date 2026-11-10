/**
 * Gives lots that were paid before the clearance time was recorded their exact one, from the
 * `payment.captured` event of the payment, so the storage reminders cover them too.
 *
 * Dry run (default), prints what would be set and writes nothing:
 *   DATABASE_URL=... pnpm --filter @auction/worker backfill:payment-cleared-at
 * Apply:
 *   DATABASE_URL=... pnpm --filter @auction/worker backfill:payment-cleared-at -- --apply
 *
 * Applying makes buyers whose deadline is in the next seven days get a storage reminder at the
 * next sweep, because their lots now have a date. Run it on production only with the owner's go.
 *
 * Safe to run again: a lot that already has a date is skipped, and the update only ever fills an
 * empty one. A lot with no capture event is listed and left empty.
 */
import { createDb } from "@auction/db";
import { domainEvent, lotFulfilment } from "@auction/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import {
  type CapturedEvent,
  planPaymentClearedBackfill,
} from "./backfill-payment-cleared-at.plan.js";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Set DATABASE_URL.");
  process.exit(1);
}
const apply = process.argv.includes("--apply");
const db = createDb(url);

const fulfilments = await db
  .select({
    lotId: lotFulfilment.lotId,
    status: lotFulfilment.status,
    paymentId: lotFulfilment.paymentId,
    paymentClearedAt: lotFulfilment.paymentClearedAt,
  })
  .from(lotFulfilment);

const rows = await db
  .select({ payload: domainEvent.payload, occurredAt: domainEvent.occurredAt })
  .from(domainEvent)
  .where(eq(domainEvent.eventType, "payment.captured"));
const events: CapturedEvent[] = rows.flatMap((row) => {
  const payload = (row.payload ?? {}) as {
    lotId?: unknown;
    paymentId?: unknown;
    capturedAt?: unknown;
  };
  const lotId = typeof payload.lotId === "string" ? payload.lotId : null;
  const paymentId = typeof payload.paymentId === "string" ? payload.paymentId : null;
  const capturedAt = new Date(
    typeof payload.capturedAt === "string" ? payload.capturedAt : row.occurredAt,
  );
  return lotId && paymentId && !Number.isNaN(capturedAt.getTime())
    ? [{ lotId, paymentId, capturedAt }]
    : [];
});

const plan = planPaymentClearedBackfill(fulfilments, events);
console.log(
  apply ? "APPLY: writing clearance times." : "DRY RUN: nothing is written. Add --apply.",
);
for (const planned of plan.dates) {
  console.log(`${planned.lotId}\t${planned.clearedAt.toISOString()}`);
}
for (const lotId of plan.withoutEvent) console.log(`${lotId}\tno capture event: left empty`);

let written = 0;
if (apply) {
  for (const planned of plan.dates) {
    const result = await db
      .update(lotFulfilment)
      .set({ paymentClearedAt: planned.clearedAt })
      .where(and(eq(lotFulfilment.lotId, planned.lotId), isNull(lotFulfilment.paymentClearedAt)))
      .returning({ lotId: lotFulfilment.lotId });
    written += result.length;
  }
}
console.log(
  `${plan.dates.length} lot(s) ${apply ? `planned, ${written} written` : "would be dated"}; ${plan.withoutEvent.length} without an event; ${plan.alreadyDated} already dated.`,
);
process.exit(0);
