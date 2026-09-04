import type { Database } from "@auction/db";
import { domainEvent, projectorState } from "@auction/db/schema";
import { identityLifecycleOutbox } from "@auction/identity-db/schema";
import { asc, eq, gt, sql } from "drizzle-orm";
import type {
  IIdentityOutboxRelayRepository,
  IdentityOutboxRelayResult,
} from "../interfaces/identity-outbox-relay.repository.js";

export const IDENTITY_LIFECYCLE_OUTBOX_RELAY_PROJECTOR = "identity_lifecycle_outbox_relay";

const RELAY_BATCH_SIZE = 100;

const IDEMPOTENT_DOMAIN_EVENT_TYPES = new Set(["user.registered", "user.email_verified"]);

export class DrizzleIdentityOutboxRelayRepository implements IIdentityOutboxRelayRepository {
  constructor(private readonly db: Database) {}

  async relayBatch(): Promise<IdentityOutboxRelayResult> {
    return this.db.transaction(async (tx) => {
      await tx
        .insert(projectorState)
        .values({
          projectorName: IDENTITY_LIFECYCLE_OUTBOX_RELAY_PROJECTOR,
          lastProcessedEventId: 0,
        })
        .onConflictDoNothing();

      const [cursorRow] = await tx
        .select({ cursor: projectorState.lastProcessedEventId })
        .from(projectorState)
        .where(eq(projectorState.projectorName, IDENTITY_LIFECYCLE_OUTBOX_RELAY_PROJECTOR))
        .for("update");

      const cursor = cursorRow?.cursor ?? 0;
      const rows = await tx
        .select()
        .from(identityLifecycleOutbox)
        .where(gt(identityLifecycleOutbox.id, cursor))
        .orderBy(asc(identityLifecycleOutbox.id))
        .limit(RELAY_BATCH_SIZE);

      if (rows.length === 0) {
        return { relayed: 0, cursor };
      }

      for (const row of rows) {
        const insert = tx.insert(domainEvent).values({
          aggregateType: row.aggregateType,
          aggregateId: row.aggregateId,
          eventType: row.eventType,
          payload: row.payload,
          producer: row.producer,
          actorUserId: row.actorUserId,
          correlationId: row.correlationId,
          schemaVersion: row.schemaVersion,
          occurredAt: row.occurredAt,
        });
        if (IDEMPOTENT_DOMAIN_EVENT_TYPES.has(row.eventType)) {
          await insert.onConflictDoNothing();
        } else {
          await insert;
        }
      }

      const maxId = rows[rows.length - 1]?.id ?? cursor;
      await tx
        .update(projectorState)
        .set({
          lastProcessedEventId: sql`greatest(${projectorState.lastProcessedEventId}, ${maxId})`,
          updatedAt: new Date(),
          lastError: null,
        })
        .where(eq(projectorState.projectorName, IDENTITY_LIFECYCLE_OUTBOX_RELAY_PROJECTOR));

      return { relayed: rows.length, cursor: maxId };
    });
  }
}
