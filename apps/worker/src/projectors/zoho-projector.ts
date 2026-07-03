import { domainEvent, projectorState } from "@auction/db";
import { sql } from "drizzle-orm";
import { rowsFromExecuteResult } from "./lib/projector-event-rows.js";
import type { ProjectorStateRepository } from "./lib/projector-state.repository.js";
import type { Projector, ProjectorRunContext } from "./lib/projector.types.js";
import { redactDomainEventPayload } from "./lib/redact-pii.js";

export const ZOHO_PROJECTOR = "zoho";

export async function processZohoProjector(
  ctx: ProjectorRunContext,
  stateRepo: ProjectorStateRepository,
): Promise<void> {
  await ctx.db.transaction(async (tx) => {
    const rows = await tx.execute(sql`
      select id, event_type, payload
      from ${domainEvent}
      where id > (select last_processed_event_id from ${projectorState} where projector_name = 'zoho')
      order by id
      limit 100
      for update skip locked
    `);
    const events = rowsFromExecuteResult(rows);
    for (const event of events) {
      ctx.log.info(
        {
          eventId: event.id,
          eventType: event.event_type,
          payload: redactDomainEventPayload(event.event_type, event.payload),
        },
        "projector observed event",
      );
    }
    const maxId = Math.max(0, ...events.map((event) => Number(event.id)));
    if (maxId > 0) {
      await stateRepo.advanceCursorLiteralName(ZOHO_PROJECTOR, maxId, tx);
    }
  });
}

export function createZohoProjector(stateRepo: ProjectorStateRepository): Projector {
  return {
    name: ZOHO_PROJECTOR,
    async run(ctx) {
      await stateRepo.ensureCursor(ZOHO_PROJECTOR);
      await processZohoProjector(ctx, stateRepo);
    },
  };
}
