/**
 * Fixture records for LAX Admin's "Mirrored to Zoho" badge (docs/design/staff-gaps-delivery-zoho-
 * alerts.md, section 2), so the browser gate opens every badge state against a real stack rather
 * than skipping the states the environment happens not to hold: per state, one paid Shop order
 * with the `zoho_fulfilment` delivery the worker would have left for its `shop.order.paid` event,
 * and one original in the artwork register with the `zoho_artwork_writeback` delivery of its
 * `artwork_register.offer_changed` event; plus one of each that nothing was sent for (no badge).
 *
 * - Mirrored: `succeeded`, with the Zoho record it reached.
 * - Sending: `retryable`, one try made and the next booked ten minutes after the seed ran.
 * - Not in Zoho: `dead_lettered`, with a redacted reason.
 * - Zoho dry run: `skipped` with the worker's dry-run reason.
 *
 * The ledger rows are made up, not written by the worker, so this runs only on a hermetic local
 * database (marked "local" and at a local address), such as the CI stack, where no worker runs. A
 * worker started on the same database would also hear the seeded events. Insert-once: records have
 * fixed ids, and a record's event and delivery are written only when it has none yet, so a second
 * run changes nothing. No real people or artworks: the names are made up.
 */
import { type Database, type SeedTargetEnv, assertSeedTarget } from "@auction/db";
import {
  ARTWORK_WRITEBACK_EVENT,
  ARTWORK_WRITEBACK_SKIP,
  ORDER_MIRROR_SKIP,
  ZOHO_MIRROR_CONSUMER,
  type ZohoMirrorRecord,
} from "@auction/types";
import { type SQL, sql } from "drizzle-orm";

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

/** The fixture artwork register record for each state, by fixed id (the badge e2e opens these). */
export const ZOHO_MIRROR_FIXTURE_ARTWORKS: Record<ZohoMirrorFixtureState, string> = {
  mirrored: "2a0e5d00-0000-4000-8000-0000000000a1",
  pending: "2a0e5d00-0000-4000-8000-0000000000a2",
  failed: "2a0e5d00-0000-4000-8000-0000000000a3",
  dry_run: "2a0e5d00-0000-4000-8000-0000000000a4",
  not_applicable: "2a0e5d00-0000-4000-8000-0000000000a5",
};

type Delivery = {
  status: "succeeded" | "retryable" | "dead_lettered" | "skipped";
  attempts: number;
  providerReference?: string;
  lastError?: string;
  /** Minutes after the seed runs that the next try is booked. */
  retryInMinutes?: number;
};

/** What the order mirror would have left for each state; none for the order nothing was sent for. */
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

/** What the artwork write-back would have left for each state; none for the unsent original. */
export const ZOHO_MIRROR_FIXTURE_ARTWORK_DELIVERIES: Record<
  ZohoMirrorFixtureState,
  Delivery | null
> = {
  mirrored: { status: "succeeded", attempts: 1, providerReference: "Product:SEED-ZM-1" },
  pending: { status: "retryable", attempts: 1, retryInMinutes: 10 },
  failed: {
    status: "dead_lettered",
    attempts: 5,
    lastError: "Zoho refused: INVALID_DATA on Status",
  },
  dry_run: { status: "skipped", attempts: 1, lastError: ARTWORK_WRITEBACK_SKIP.dryRun },
  not_applicable: null,
};

function rowsOf<T>(result: unknown): T[] {
  return (Array.isArray(result) ? result : (result as { rows: unknown[] }).rows) as T[];
}

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

/** How one kind of fixture record is written and which event of it the mirror heard. */
type FixtureKind = {
  record: ZohoMirrorRecord;
  ids: Record<ZohoMirrorFixtureState, string>;
  deliveries: Record<ZohoMirrorFixtureState, Delivery | null>;
  aggregateType: string;
  eventType: string;
  payload: (id: string) => Record<string, unknown>;
  /** Writes the record itself, insert-once; true when this run wrote it. */
  insert: (tx: Tx, id: string, state: ZohoMirrorFixtureState, at: Date) => Promise<boolean>;
};

async function insertedOnce(tx: Tx, statement: SQL): Promise<boolean> {
  return rowsOf(await tx.execute(statement)).length > 0;
}

const ORDERS: FixtureKind = {
  record: "order",
  ids: ZOHO_MIRROR_FIXTURE_ORDERS,
  deliveries: ZOHO_MIRROR_FIXTURE_DELIVERIES,
  aggregateType: "shop_order",
  eventType: "shop.order.paid",
  payload: (orderId) => ({ schemaVersion: 1, orderId }),
  insert: (tx, orderId, state, at) =>
    insertedOnce(
      tx,
      sql`
        INSERT INTO shop_order (id, identity_subject_id, status, fulfilment,
          merchandise_subtotal_pence, fulfilment_surcharge_pence, total_pence, idempotency_key,
          paid_at, created_at, updated_at)
        VALUES (${orderId}, ${ZOHO_MIRROR_BADGE_SEED}, 'paid', 'uk_insured_delivery', 12500, 0,
          12500, ${`${ZOHO_MIRROR_BADGE_SEED}:${state}`}, ${at}, ${at}, ${at})
        ON CONFLICT (id) DO NOTHING
        RETURNING id
      `,
    ),
};

const ARTWORKS: FixtureKind = {
  record: "artwork",
  ids: ZOHO_MIRROR_FIXTURE_ARTWORKS,
  deliveries: ZOHO_MIRROR_FIXTURE_ARTWORK_DELIVERIES,
  aggregateType: "artwork_register",
  eventType: ARTWORK_WRITEBACK_EVENT.offerChanged,
  payload: (registerId) => ({ schemaVersion: 1, registerId }),
  insert: (tx, registerId, state, at) => {
    // A real original's stock code shape (the register checks it), numbered 9901 up by state.
    const code = `LAX-ORI-FA-ZMB-26-${9901 + Object.keys(ZOHO_MIRROR_FIXTURE_ARTWORKS).indexOf(state)}`;
    return insertedOnce(
      tx,
      sql`
        INSERT INTO artwork_register (id, zoho_product_id, stock_code, kind, title, artist_name,
          artist_code, catalogue_status, zoho_modified_at, created_at, updated_at)
        VALUES (${registerId}, ${`seed-zoho-mirror-${state}`}, ${code}, 'original',
          ${`Zoho badge fixture (${state.replace("_", " ")})`}, 'Fixture Artist', 'FA',
          'Available', ${at}, ${at}, ${at})
        ON CONFLICT (id) DO NOTHING
        RETURNING id
      `,
    );
  },
};

/** The record's event and the consumer's delivery of it, unless this seed already wrote them. */
async function writeLedger(
  tx: Tx,
  kind: FixtureKind,
  id: string,
  state: ZohoMirrorFixtureState,
  delivery: Delivery,
  at: Date,
  now: Date,
): Promise<boolean> {
  const existing = await tx.execute(sql`
    SELECT 1 FROM domain_events
    WHERE aggregate_type = ${kind.aggregateType} AND aggregate_id = ${id}
      AND producer = ${ZOHO_MIRROR_BADGE_SEED}
    LIMIT 1
  `);
  if (rowsOf(existing).length > 0) return false;
  const event = await tx.execute(sql`
    INSERT INTO domain_events (aggregate_type, aggregate_id, event_type, payload, producer, occurred_at)
    VALUES (${kind.aggregateType}, ${id}, ${kind.eventType},
      ${JSON.stringify(kind.payload(id))}::jsonb, ${ZOHO_MIRROR_BADGE_SEED}, ${at})
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
    VALUES (${ZOHO_MIRROR_CONSUMER[kind.record]}, ${eventId}, ${delivery.status},
      ${delivery.attempts}, ${`${ZOHO_MIRROR_BADGE_SEED}:${kind.record}:${state}`},
      ${delivery.providerReference ?? null}, ${delivery.lastError ?? null}, ${retryAt}, ${at}, ${at})
  `);
  return true;
}

/** Writes one kind's fixtures; returns the states this run wrote anything for. */
async function seedKind(
  db: Database,
  kind: FixtureKind,
  at: Date,
  now: Date,
): Promise<ZohoMirrorFixtureState[]> {
  const created: ZohoMirrorFixtureState[] = [];
  for (const [state, id] of Object.entries(kind.ids) as [ZohoMirrorFixtureState, string][]) {
    await db.transaction(async (tx) => {
      const recordCreated = await kind.insert(tx, id, state, at);
      const delivery = kind.deliveries[state];
      const ledgerCreated = delivery
        ? await writeLedger(tx, kind, id, state, delivery, at, now)
        : false;
      if (recordCreated || ledgerCreated) created.push(state);
    });
  }
  return created;
}

export type ZohoMirrorBadgeSeedResult = {
  orders: typeof ZOHO_MIRROR_FIXTURE_ORDERS;
  artworks: typeof ZOHO_MIRROR_FIXTURE_ARTWORKS;
  /** The states whose order, or whose order's delivery, this run wrote; empty on a second run. */
  created: ZohoMirrorFixtureState[];
  /** The same for the artworks. */
  createdArtworks: ZohoMirrorFixtureState[];
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
  // A month back, so the fixtures sit below the records the other checks open from the lists.
  const at = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const created = await seedKind(db, ORDERS, at, now);
  const createdArtworks = await seedKind(db, ARTWORKS, at, now);
  return {
    orders: ZOHO_MIRROR_FIXTURE_ORDERS,
    artworks: ZOHO_MIRROR_FIXTURE_ARTWORKS,
    created,
    createdArtworks,
  };
}
