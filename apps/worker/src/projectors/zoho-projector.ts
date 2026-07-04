import type { Projector, ProjectorRunContext } from "./lib/projector.types.js";
import { redactDomainEventPayload } from "./lib/redact-pii.js";

export const ZOHO_PROJECTOR = "zoho";

export async function processZohoProjector(ctx: ProjectorRunContext): Promise<void> {
  await ctx.transactionRunner.runInTransaction(async (tx) => {
    const events = await ctx.domainEventReader.listLockedForProjector(ZOHO_PROJECTOR, 100, tx);
    for (const event of events) {
      ctx.log.info(
        {
          eventId: event.id,
          eventType: event.eventType,
          payload: redactDomainEventPayload(event.eventType, event.payload),
        },
        "projector observed event",
      );
    }
    const maxId = Math.max(0, ...events.map((event) => event.id));
    if (maxId > 0) {
      await ctx.projectorStateRepo.advanceCursorLiteralName(ZOHO_PROJECTOR, maxId, tx);
    }
  });
}

export function createZohoProjector(): Projector {
  return {
    name: ZOHO_PROJECTOR,
    async run(ctx) {
      await ctx.projectorStateRepo.ensureCursor(ZOHO_PROJECTOR);
      await processZohoProjector(ctx);
    },
  };
}
