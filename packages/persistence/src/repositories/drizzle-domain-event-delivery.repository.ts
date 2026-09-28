import type { Database } from "@auction/db";
import { domainEventDelivery } from "@auction/db/schema";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type {
  ClaimDomainEventDeliveriesInput,
  DomainEventDeliveryRow,
  IDomainEventDeliveryRepository,
} from "../interfaces/domain-event-delivery.repository.js";

const MAX_LAST_ERROR_LEN = 2_000;

type ClaimedRow = {
  id: number;
  consumer: string;
  event_id: number;
  status: string;
  attempts: number;
  lease_expires_at: Date | null;
  next_retry_at: Date | null;
  idempotency_key: string | null;
  provider_reference: string | null;
  last_error: string | null;
  created_at: Date;
  updated_at: Date;
};

function redactDeliveryError(message: string): string {
  const trimmed = message.trim().slice(0, MAX_LAST_ERROR_LEN);
  return trimmed.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[REDACTED_EMAIL]");
}

function mapRow(r: ClaimedRow): DomainEventDeliveryRow {
  return {
    id: r.id,
    consumer: r.consumer,
    eventId: r.event_id,
    status: r.status as DomainEventDeliveryRow["status"],
    attempts: r.attempts,
    leaseExpiresAt: r.lease_expires_at,
    nextRetryAt: r.next_retry_at,
    idempotencyKey: r.idempotency_key,
    providerReference: r.provider_reference,
    lastError: r.last_error,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function rowsFromExecuteResult(result: unknown): ClaimedRow[] {
  if (Array.isArray(result)) return result as ClaimedRow[];
  if (result && typeof result === "object" && "rows" in result) {
    return (result as { rows?: ClaimedRow[] }).rows ?? [];
  }
  return [];
}

export class DrizzleDomainEventDeliveryRepository implements IDomainEventDeliveryRepository {
  constructor(private readonly db: Database) {}

  async claim(input: ClaimDomainEventDeliveriesInput): Promise<DomainEventDeliveryRow[]> {
    const now = input.now ?? new Date();
    const leaseUntil = new Date(now.getTime() + input.leaseMs);

    return this.db.transaction(async (tx) => {
      const selected = await tx.execute(sql`
        SELECT id, consumer, event_id, status, attempts, lease_expires_at, next_retry_at,
               idempotency_key, provider_reference, last_error, created_at, updated_at
        FROM domain_event_delivery
        WHERE consumer = ${input.consumer}
          AND (
            status = 'pending'
            OR (
              status = 'retryable'
              AND (next_retry_at IS NULL OR next_retry_at <= ${now})
            )
            OR (
              status = 'processing'
              AND lease_expires_at IS NOT NULL
              AND lease_expires_at <= ${now}
            )
          )
        ORDER BY COALESCE(next_retry_at, created_at), id
        LIMIT ${input.batchSize}
        FOR UPDATE SKIP LOCKED
      `);

      const rows = rowsFromExecuteResult(selected);
      if (rows.length === 0) return [];

      const ids = rows.map((r) => r.id);
      await tx
        .update(domainEventDelivery)
        .set({
          status: "processing",
          leaseExpiresAt: leaseUntil,
          attempts: sql`${domainEventDelivery.attempts} + 1`,
          updatedAt: now,
        })
        .where(inArray(domainEventDelivery.id, ids));

      return rows.map((r) =>
        mapRow({
          ...r,
          status: "processing",
          attempts: r.attempts + 1,
          lease_expires_at: leaseUntil,
        }),
      );
    });
  }

  async renewLease(input: { deliveryId: number; leaseMs: number; now?: Date }): Promise<boolean> {
    const now = input.now ?? new Date();
    const leaseUntil = new Date(now.getTime() + input.leaseMs);
    const updated = await this.db
      .update(domainEventDelivery)
      .set({ leaseExpiresAt: leaseUntil, updatedAt: now })
      .where(
        and(
          eq(domainEventDelivery.id, input.deliveryId),
          eq(domainEventDelivery.status, "processing"),
        ),
      )
      .returning({ id: domainEventDelivery.id });
    return updated.length > 0;
  }

  async markSucceeded(input: {
    deliveryId: number;
    providerReference?: string | null;
    now?: Date;
  }): Promise<void> {
    const now = input.now ?? new Date();
    await this.db
      .update(domainEventDelivery)
      .set({
        status: "succeeded",
        providerReference: input.providerReference ?? null,
        leaseExpiresAt: null,
        nextRetryAt: null,
        lastError: null,
        updatedAt: now,
      })
      .where(eq(domainEventDelivery.id, input.deliveryId));
  }

  async markSkipped(input: {
    deliveryId: number;
    reason: string;
    providerReference?: string | null;
    now?: Date;
  }): Promise<void> {
    const now = input.now ?? new Date();
    await this.db
      .update(domainEventDelivery)
      .set({
        status: "skipped",
        providerReference: input.providerReference ?? null,
        leaseExpiresAt: null,
        nextRetryAt: null,
        lastError: redactDeliveryError(input.reason),
        updatedAt: now,
      })
      .where(eq(domainEventDelivery.id, input.deliveryId));
  }

  async replaySkippedForEventTypes(input: {
    consumer: string;
    eventTypes: readonly string[];
    limit: number;
    now?: Date;
  }): Promise<number> {
    if (input.eventTypes.length === 0) return 0;
    const now = input.now ?? new Date();
    const eventTypeList = sql.join(
      input.eventTypes.map((eventType) => sql`${eventType}`),
      sql`, `,
    );
    const rows = await this.db.execute(sql`
      UPDATE domain_event_delivery d
      SET status = 'pending', next_retry_at = NULL, lease_expires_at = NULL,
          last_error = NULL, updated_at = ${now}
      WHERE d.id IN (
        SELECT d2.id
        FROM domain_event_delivery d2
        INNER JOIN domain_events e ON e.id = d2.event_id
        WHERE d2.consumer = ${input.consumer}
          AND d2.status = 'skipped'
          AND e.event_type IN (${eventTypeList})
        ORDER BY d2.id
        LIMIT ${input.limit}
      )
      RETURNING d.id
    `);
    return rowsFromExecuteResult(rows).length;
  }

  async scheduleRetry(input: {
    deliveryId: number;
    nextRetryAt: Date;
    lastError: string;
    undoAttemptIncrement?: boolean;
    now?: Date;
  }): Promise<void> {
    const now = input.now ?? new Date();
    await this.db
      .update(domainEventDelivery)
      .set({
        status: "retryable",
        nextRetryAt: input.nextRetryAt,
        lastError: redactDeliveryError(input.lastError),
        leaseExpiresAt: null,
        updatedAt: now,
        ...(input.undoAttemptIncrement
          ? { attempts: sql`GREATEST(0, ${domainEventDelivery.attempts} - 1)` }
          : {}),
      })
      .where(eq(domainEventDelivery.id, input.deliveryId));
  }

  async oldestPendingAt(input: { consumer: string; now?: Date }): Promise<Date | null> {
    const now = input.now ?? new Date();
    const result = await this.db.execute(sql`
      SELECT MIN(created_at) AS oldest_at
      FROM domain_event_delivery
      WHERE consumer = ${input.consumer}
        AND (
          status = 'pending'
          OR status = 'processing'
          OR (
            status = 'retryable'
            AND (next_retry_at IS NULL OR next_retry_at <= ${now})
          )
        )
    `);
    const rows = rowsFromExecuteResult(result) as unknown as Array<{
      oldest_at: Date | string | null;
    }>;
    const oldest = rows[0]?.oldest_at;
    if (oldest == null) return null;
    return oldest instanceof Date ? oldest : new Date(oldest);
  }

  async deadLetter(input: { deliveryId: number; lastError: string; now?: Date }): Promise<void> {
    const now = input.now ?? new Date();
    await this.db
      .update(domainEventDelivery)
      .set({
        status: "dead_lettered",
        lastError: redactDeliveryError(input.lastError),
        leaseExpiresAt: null,
        updatedAt: now,
      })
      .where(eq(domainEventDelivery.id, input.deliveryId));
  }

  async replay(input: { deliveryId: number; now?: Date }): Promise<void> {
    const now = input.now ?? new Date();
    await this.db
      .update(domainEventDelivery)
      .set({
        status: "pending",
        nextRetryAt: null,
        leaseExpiresAt: null,
        lastError: null,
        updatedAt: now,
      })
      .where(eq(domainEventDelivery.id, input.deliveryId));
  }

  async ensurePending(input: {
    consumer: string;
    eventId: number;
    idempotencyKey: string;
    now?: Date;
  }): Promise<void> {
    const now = input.now ?? new Date();
    await this.db
      .insert(domainEventDelivery)
      .values({
        consumer: input.consumer,
        eventId: input.eventId,
        status: "pending",
        idempotencyKey: input.idempotencyKey,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing();
  }

  async getById(deliveryId: number): Promise<DomainEventDeliveryRow | null> {
    const [row] = await this.db
      .select()
      .from(domainEventDelivery)
      .where(eq(domainEventDelivery.id, deliveryId))
      .limit(1);
    if (!row) return null;
    return {
      id: row.id,
      consumer: row.consumer,
      eventId: row.eventId,
      status: row.status,
      attempts: row.attempts,
      leaseExpiresAt: row.leaseExpiresAt,
      nextRetryAt: row.nextRetryAt,
      idempotencyKey: row.idempotencyKey,
      providerReference: row.providerReference,
      lastError: row.lastError,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async listDeadLettered(input: {
    consumer?: string;
    limit: number;
    offset: number;
  }): Promise<DomainEventDeliveryRow[]> {
    const conditions = input.consumer
      ? and(
          eq(domainEventDelivery.status, "dead_lettered"),
          eq(domainEventDelivery.consumer, input.consumer),
        )
      : eq(domainEventDelivery.status, "dead_lettered");
    const rows = await this.db
      .select()
      .from(domainEventDelivery)
      .where(conditions)
      .orderBy(desc(domainEventDelivery.updatedAt))
      .limit(input.limit)
      .offset(input.offset);
    return rows.map((row) => ({
      id: row.id,
      consumer: row.consumer,
      eventId: row.eventId,
      status: row.status,
      attempts: row.attempts,
      leaseExpiresAt: row.leaseExpiresAt,
      nextRetryAt: row.nextRetryAt,
      idempotencyKey: row.idempotencyKey,
      providerReference: row.providerReference,
      lastError: row.lastError,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }
}
