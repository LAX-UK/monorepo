/**
 * Fixture orders for LAX Admin's "Mirrored to Zoho" badge (docs/design/staff-gaps-delivery-zoho-
 * alerts.md, section 2), so the browser gate opens every badge state against a real stack rather
 * than skipping the states the environment happens not to hold: one paid Shop order per state,
 * each with the `zoho_fulfilment` delivery the worker would have left for its `shop.order.paid`
 * event, plus one paid order nothing was sent for (no badge).
 *
 * - Mirrored: `succeeded`, with the Zoho record it reached.
 * - Sending: `retryable`, one try made and the next booked ten minutes after the seed ran.
 * - Not in Zoho: `dead_lettered`, with a redacted reason.
 * - Zoho dry run: `skipped` with the worker's dry-run reason.
 *
 * The ledger rows are made up, not written by the worker, so this runs only on a hermetic local
 * database (marked "local" and at a local address), such as the CI stack, where no worker runs. A
 * worker started on the same database would also hear the seeded `shop.order.paid` events.
 * Insert-once: orders have fixed ids, and an order's event and delivery are written only when it
 * has none yet, so a second run changes nothing.
 */
import { type Database, type SeedTargetEnv, assertSeedTarget } from "@auction/db";
import { ORDER_MIRROR_SKIP, ZOHO_MIRROR_CONSUMER } from "@auction/types";
import { sql } from "drizzle-orm";

export const ZOHO_MIRROR_BADGE_SEED = "seed:zoho-mirror-badge";

/** The fixture order for each state, by fixed id (the badge e2e looks these up). */
export const ZOHO_MIRROR_FIXTURE_ORDERS = {
  mirrored: "2a0e5d00-0000-4000-8000-000000000001",
  pending: "2a0e5d00-0000-4000-8000-000000000002",
  failed: "2a0e5d00-0000-4000-8000-000000000003",
  dry_run: "2a0e5d00-0000-4000-8000-000000000004",
  not_applicable: "2a0e5d00-0000-4000-8000-000000000005",
} as const;

export type ZohoMirrorFixtureState = keyof typeof ZOHO_MIRROR_FIXTURE_ORDERS;

type Delivery = {
  status: "succeeded" | "retryable" | "dead_lettered" | "skipped";
  attempts: number;
  providerReference?: string;
  lastError?: string;
  /** Minutes after the seed runs that the next try is booked. */
  retryInMinutes?: number;
};

/** What the worker would have left for each state; none for the order nothing was sent for. */
export const ZOHO_MIRROR_FIXTURE_DELIVERIES: Record<ZohoMirrorFixtureState, Delivery | null> = {
  mirrored: { status: "succeeded", attempts: 1, providerReference: "Order:LAX-S-SEED-1" },
  pending: { status: "retryable", attempts: 1, retryInMinutes: 10 },
  failed: {
    status: "dead_lettered",
    attempts: 5,
    lastError: "Zoho refused: INVALID_DATA on Dispatch_Status",
  },
  dry_run: { status: "skipped", attempts: 1, lastError: ORDER_MIRROR_SKIP.dryRun },
  not_applicable: null,
};

function rowsOf<T>(result: unknown): T[] {
  return (Array.isArray(result) ? result : (result as { rows: unknown[] }).rows) as T[];
}

export type ZohoMirrorBadgeSeedResult = {
  orders: typeof ZOHO_MIRROR_FIXTURE_ORDERS;
  /** The states whose order or delivery this run wrote; empty on a second run. */
  created: ZohoMirrorFixtureState[];
};

export async function seedZohoMirrorBadgeFixtures(
  db: Database,
  env: SeedTargetEnv,
  now: Date = new Date(),
): Promise<ZohoMirrorBadgeSeedResult> {
  const target = await assertSeedTarget(db, ZOHO_MIRROR_BADGE_SEED, env);
  if (!target.hermetic) {
    throw new Error(
      `[${ZOHO_MIRROR_BADGE_SEED}] refusing to seed: the database is marked "${target.environment}", not a hermetic local one`,
    );
  }
  const created: ZohoMirrorFixtureState[] = [];
  // A month back, so the fixtures sit below the orders the other checks open from the list.
  const paidAt = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  for (const [state, orderId] of Object.entries(ZOHO_MIRROR_FIXTURE_ORDERS) as [
    ZohoMirrorFixtureState,
    string,
  ][]) {
    await db.transaction(async (tx) => {
      const inserted = await tx.execute(sql`
        INSERT INTO shop_order (id, identity_subject_id, status, fulfilment,
          merchandise_subtotal_pence, fulfilment_surcharge_pence, total_pence, idempotency_key,
          paid_at, created_at, updated_at)
        VALUES (${orderId}, ${ZOHO_MIRROR_BADGE_SEED}, 'paid', 'uk_insured_delivery', 12500, 0,
          12500, ${`${ZOHO_MIRROR_BADGE_SEED}:${state}`}, ${paidAt}, ${paidAt}, ${paidAt})
        ON CONFLICT (id) DO NOTHING
        RETURNING id
      `);
      const delivery = ZOHO_MIRROR_FIXTURE_DELIVERIES[state];
      const orderCreated = rowsOf(inserted).length > 0;
      if (!delivery) {
        if (orderCreated) created.push(state);
        return;
      }
      const existing = await tx.execute(sql`
        SELECT 1 FROM domain_events
        WHERE aggregate_type = 'shop_order' AND aggregate_id = ${orderId}
          AND producer = ${ZOHO_MIRROR_BADGE_SEED}
        LIMIT 1
      `);
      if (rowsOf(existing).length > 0) return;
      const event = await tx.execute(sql`
        INSERT INTO domain_events (aggregate_type, aggregate_id, event_type, payload, producer, occurred_at)
        VALUES ('shop_order', ${orderId}, 'shop.order.paid',
          ${JSON.stringify({ schemaVersion: 1, orderId })}::jsonb, ${ZOHO_MIRROR_BADGE_SEED}, ${paidAt})
        RETURNING id
      `);
      const eventId = Number(rowsOf<{ id: number | string }>(event)[0]?.id);
      const retryAt =
        delivery.retryInMinutes === undefined
          ? null
          : new Date(now.getTime() + delivery.retryInMinutes * 60 * 1000);
      await tx.execute(sql`
        INSERT INTO domain_event_delivery (consumer, event_id, status, attempts, idempotency_key,
          provider_reference, last_error, next_retry_at, created_at, updated_at)
        VALUES (${ZOHO_MIRROR_CONSUMER.order}, ${eventId}, ${delivery.status}, ${delivery.attempts},
          ${`${ZOHO_MIRROR_BADGE_SEED}:${state}`}, ${delivery.providerReference ?? null},
          ${delivery.lastError ?? null}, ${retryAt}, ${paidAt}, ${paidAt})
      `);
      created.push(state);
    });
  }
  return { orders: ZOHO_MIRROR_FIXTURE_ORDERS, created };
}
