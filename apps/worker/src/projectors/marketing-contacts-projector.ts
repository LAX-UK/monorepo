import { domainEvent, projectorState } from "@auction/db";
import { sql } from "drizzle-orm";
import { type ProjectorEventRow, rowsFromExecuteResult } from "./lib/projector-event-rows.js";
import type { ProjectorStateRepository } from "./lib/projector-state.repository.js";
import type { Projector, ProjectorRunContext } from "./lib/projector.types.js";

export const MARKETING_CONTACTS_PROJECTOR = "marketing_contacts";

/** Domain events that should (re)sync a user into the marketing-contacts ESP. */
const MARKETING_CONTACT_EVENT_REASONS: Record<string, string | undefined> = {
  "user.registered": "registered",
  "user.email_verified": "email_verified",
  "user.deletion_requested": "deletion_requested",
  "kyc.verified": "kyc_verified",
};

function userIdFromEvent(payload: unknown, aggregateId: string): string | null {
  if (payload && typeof payload === "object") {
    const candidate = (payload as Record<string, unknown>).userId;
    if (typeof candidate === "string" && candidate.length > 0) return candidate;
  }
  return aggregateId.length > 0 ? aggregateId : null;
}

export async function processMarketingContactsProjector(
  ctx: ProjectorRunContext,
  stateRepo: ProjectorStateRepository,
): Promise<void> {
  const enqueue = ctx.enqueueMarketingContactSync;
  if (!enqueue) return;

  await stateRepo.ensureCursor(MARKETING_CONTACTS_PROJECTOR);
  await ctx.transactionRunner.runInTransaction(async (tx) => {
    const rows = await tx.execute(sql`
      select id, event_type, aggregate_id, payload
      from ${domainEvent}
      where id > (select last_processed_event_id from ${projectorState} where projector_name = ${MARKETING_CONTACTS_PROJECTOR})
      order by id
      limit 100
      for update skip locked
    `);
    const events = rowsFromExecuteResult(rows) as Array<
      ProjectorEventRow & { aggregate_id: string }
    >;
    for (const event of events) {
      const reason = MARKETING_CONTACT_EVENT_REASONS[event.event_type];
      if (!reason) continue;
      const userId = userIdFromEvent(event.payload, event.aggregate_id);
      if (!userId) {
        ctx.log.warn({ eventId: event.id }, "marketing_contact_sync_skipped_missing_user");
        continue;
      }
      // Enqueue inside the cursor transaction; the worker uses a stable jobId so a
      // retried tick (cursor not yet advanced) collapses to the same BullMQ job.
      await enqueue({ userId, reason, eventId: Number(event.id) });
    }
    const maxId = Math.max(0, ...events.map((event) => Number(event.id)));
    if (maxId > 0) {
      await stateRepo.advanceCursorLiteralName(MARKETING_CONTACTS_PROJECTOR, maxId, tx);
    }
  });
}

export function createMarketingContactsProjector(stateRepo: ProjectorStateRepository): Projector {
  return {
    name: MARKETING_CONTACTS_PROJECTOR,
    isEnabled(ctx) {
      return ctx.enqueueMarketingContactSync != null;
    },
    async run(ctx) {
      await processMarketingContactsProjector(ctx, stateRepo);
    },
  };
}
