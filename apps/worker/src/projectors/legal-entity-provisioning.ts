import { EnsurePersonalLegalEntityService } from "../services/ensure-personal-legal-entity.service.js";
import { domainEvent, projectorState } from "@auction/db/schema";
import { and, eq, gt } from "drizzle-orm";
import type pino from "pino";

export const LEGAL_ENTITY_PROVISIONING_PROJECTOR = "legal_entity_provisioning";

type Db = typeof import("@auction/db").createDb extends (url: string) => infer T ? T : never;

type UserRegisteredPayload = {
  userId?: string;
  email?: string;
  name?: string;
  source?: string;
};

export async function applyUserRegisteredEvent(
  ensure: EnsurePersonalLegalEntityService,
  event: { id: number; payload: unknown },
  log: pino.Logger,
): Promise<void> {
  const payload = event.payload as UserRegisteredPayload;
  if (!payload?.userId || !payload?.email) {
    log.warn({ eventId: event.id }, "legal_entity_provisioning_skipped_malformed_payload");
    return;
  }
  await ensure.ensure({
    userId: payload.userId,
    displayName: payload.name ?? "",
    email: payload.email,
  });
}

export async function processLegalEntityProvisioning(options: {
  db: Db;
  log: pino.Logger;
}): Promise<void> {
  const { db, log } = options;
  const ensure = new EnsurePersonalLegalEntityService(db);

  await db
    .insert(projectorState)
    .values({ projectorName: LEGAL_ENTITY_PROVISIONING_PROJECTOR, lastProcessedEventId: 0 })
    .onConflictDoNothing();

  const [cursorRow] = await db
    .select({ last: projectorState.lastProcessedEventId })
    .from(projectorState)
    .where(eq(projectorState.projectorName, LEGAL_ENTITY_PROVISIONING_PROJECTOR))
    .limit(1);
  const cursor = cursorRow?.last ?? 0;

  const rows = await db
    .select({
      id: domainEvent.id,
      payload: domainEvent.payload,
    })
    .from(domainEvent)
    .where(and(gt(domainEvent.id, cursor), eq(domainEvent.eventType, "user.registered")))
    .orderBy(domainEvent.id)
    .limit(50);

  if (rows.length === 0) {
    return;
  }

  let maxId = cursor;
  for (const row of rows) {
    try {
      await applyUserRegisteredEvent(ensure, row, log);
      maxId = row.id;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.error({ err, eventId: row.id }, "legal_entity_provisioning_failed");
      await db
        .update(projectorState)
        .set({ lastError: message, updatedAt: new Date() })
        .where(eq(projectorState.projectorName, LEGAL_ENTITY_PROVISIONING_PROJECTOR));
      return;
    }
  }

  if (maxId > cursor) {
    await db
      .update(projectorState)
      .set({ lastProcessedEventId: maxId, updatedAt: new Date(), lastError: null })
      .where(eq(projectorState.projectorName, LEGAL_ENTITY_PROVISIONING_PROJECTOR));
  }
}
