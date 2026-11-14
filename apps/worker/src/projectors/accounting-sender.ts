import type { Projector, ProjectorRunContext } from "./lib/projector.types.js";

export const ACCOUNTING_SENDER = "accounting_sender";

/**
 * Sends the queued accounting documents, after the projector has queued them in the same tick.
 * A failure is logged and kept to this step, so it never holds up the projectors after it.
 */
export async function processAccountingSender(ctx: ProjectorRunContext): Promise<void> {
  if (!ctx.accounting) return;
  const { sender, senderCheckIn, invoiceCopy, remainder } = ctx.accounting;
  try {
    await senderCheckIn(async () => {
      const tick = await sender.tick();
      if (tick.active && tick.sent + tick.lookedUp + tick.requeued + tick.escalated > 0) {
        ctx.log.info({ ...tick }, "accounting_sender_tick");
      }
    });
  } catch (err) {
    ctx.log.error({ err }, "accounting_sender_tick_failed");
  }
  // After the sender: a Shop delivery invoice issued this tick is paid from the order's payment.
  try {
    const applied = await remainder.tick();
    if (applied.applied + applied.refused > 0) {
      ctx.log.info({ ...applied }, "accounting_remainder_tick");
    }
  } catch (err) {
    ctx.log.error({ err }, "accounting_remainder_tick_failed");
  }
  // After the sender, so a document issued this tick gets its copy (and email) straight away.
  try {
    const copied = await invoiceCopy.tick();
    if (copied.stored + copied.emailed > 0) ctx.log.info({ ...copied }, "accounting_copy_tick");
  } catch (err) {
    ctx.log.error({ err }, "accounting_copy_tick_failed");
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
