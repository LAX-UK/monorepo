import type { Projector, ProjectorRunContext } from "./lib/projector.types.js";

export const XERO_PROJECTOR = "xero";

export async function processXeroProjector(ctx: ProjectorRunContext): Promise<void> {
  const cursor = await ctx.projectorStateRepo.getCursor(XERO_PROJECTOR);

  const rows = await ctx.domainEventReader.listAfterCursor(cursor, { limit: 100 });

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
    await ctx.projectorStateRepo.advanceCursor(XERO_PROJECTOR, maxId);
  }
}

export function createXeroProjector(): Projector {
  return {
    name: XERO_PROJECTOR,
    async run(ctx) {
      await ctx.projectorStateRepo.ensureCursor(XERO_PROJECTOR);
      await processXeroProjector(ctx);
    },
  };
}
