import { domainEvent, projectorState } from "@auction/db";
import { eq, gt } from "drizzle-orm";
import type { ProjectorStateRepository } from "./lib/projector-state.repository.js";
import type { Projector, ProjectorRunContext } from "./lib/projector.types.js";

export const XERO_PROJECTOR = "xero";

export async function processXeroProjector(
  ctx: ProjectorRunContext,
  stateRepo: ProjectorStateRepository,
): Promise<void> {
  const cursor = await stateRepo.getCursor(XERO_PROJECTOR);

  const rows = await ctx.db
    .select({
      id: domainEvent.id,
      eventType: domainEvent.eventType,
      aggregateId: domainEvent.aggregateId,
    })
    .from(domainEvent)
    .where(gt(domainEvent.id, cursor))
    .orderBy(domainEvent.id)
    .limit(100);

  if (rows.length === 0) {
    return;
  }

  let maxId = cursor;
  for (const row of rows) {
    maxId = row.id;
    if (row.eventType === "payout.paid" && ctx.syncXeroPayoutBill) {
      const ok = await ctx.syncXeroPayoutBill(row.aggregateId).catch((err: unknown) => {
        ctx.log.error({ err, payoutId: row.aggregateId }, "xero_payout_bill_sync_threw");
        return false;
      });
      if (!ok) {
        maxId = Math.max(cursor, row.id - 1);
        break;
      }
    }
  }

  if (maxId > cursor) {
    await ctx.db
      .update(projectorState)
      .set({ lastProcessedEventId: maxId, updatedAt: new Date(), lastError: null })
      .where(eq(projectorState.projectorName, XERO_PROJECTOR));
  }
}

export function createXeroProjector(stateRepo: ProjectorStateRepository): Projector {
  return {
    name: XERO_PROJECTOR,
    async run(ctx) {
      await stateRepo.ensureCursor(XERO_PROJECTOR);
      await processXeroProjector(ctx, stateRepo);
    },
  };
}
