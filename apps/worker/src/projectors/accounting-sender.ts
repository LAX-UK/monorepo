import type { Projector, ProjectorRunContext } from "./lib/projector.types.js";

export const ACCOUNTING_SENDER = "accounting_sender";

/**
 * Sends the queued accounting documents, after the projector has queued them in the same tick.
 * A failure is logged and kept to this step, so it never holds up the projectors after it.
 */
export async function processAccountingSender(ctx: ProjectorRunContext): Promise<void> {
  if (!ctx.accounting) return;
  try {
    const tick = await ctx.accounting.sender.tick();
    if (tick.active && tick.sent + tick.lookedUp + tick.requeued + tick.escalated > 0) {
      ctx.log.info({ ...tick }, "accounting_sender_tick");
    }
  } catch (err) {
    ctx.log.error({ err }, "accounting_sender_tick_failed");
  }
}

export function createAccountingSender(): Projector {
  return {
    name: ACCOUNTING_SENDER,
    isEnabled(ctx) {
      return ctx.accounting != null;
    },
    async run(ctx) {
      await processAccountingSender(ctx);
    },
  };
}
