import type { IEnsurePersonalLegalEntityService } from "@auction/persistence/lib";
import type pino from "pino";
import type { ProjectorRunContext } from "./lib/projector.types.js";

export const LEGAL_ENTITY_PROVISIONING_PROJECTOR = "legal_entity_provisioning";

type UserRegisteredPayload = {
  userId?: string;
  email?: string;
  name?: string;
  source?: string;
};

export async function applyUserRegisteredEvent(
  ensure: IEnsurePersonalLegalEntityService,
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
  ctx: ProjectorRunContext;
  log: pino.Logger;
}): Promise<void> {
  const { ctx, log } = options;
  const { projectorStateRepo, domainEventReader, ensurePersonalLegalEntity } = ctx;

  await projectorStateRepo.ensureCursor(LEGAL_ENTITY_PROVISIONING_PROJECTOR);

  const cursor = await projectorStateRepo.getCursor(LEGAL_ENTITY_PROVISIONING_PROJECTOR);

  const rows = await domainEventReader.listAfterCursor(cursor, {
    eventTypes: ["user.registered"],
    limit: 50,
  });

  if (rows.length === 0) {
    return;
  }

  let maxId = cursor;
  for (const row of rows) {
    try {
      await applyUserRegisteredEvent(ensurePersonalLegalEntity, row, log);
      maxId = row.id;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.error({ err, eventId: row.id }, "legal_entity_provisioning_failed");
      await projectorStateRepo.recordError(LEGAL_ENTITY_PROVISIONING_PROJECTOR, message);
      return;
    }
  }

  if (maxId > cursor) {
    await projectorStateRepo.advanceCursor(LEGAL_ENTITY_PROVISIONING_PROJECTOR, maxId);
  }
}
