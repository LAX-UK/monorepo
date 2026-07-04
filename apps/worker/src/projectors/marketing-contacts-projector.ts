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

export async function processMarketingContactsProjector(ctx: ProjectorRunContext): Promise<void> {
  const enqueue = ctx.enqueueMarketingContactSync;
  if (!enqueue) return;

  await ctx.projectorStateRepo.ensureCursor(MARKETING_CONTACTS_PROJECTOR);
  await ctx.transactionRunner.runInTransaction(async (tx) => {
    const events = await ctx.domainEventReader.listLockedForProjector(
      MARKETING_CONTACTS_PROJECTOR,
      100,
      tx,
    );
    for (const event of events) {
      const reason = MARKETING_CONTACT_EVENT_REASONS[event.eventType];
      if (!reason) continue;
      const userId = userIdFromEvent(event.payload, event.aggregateId);
      if (!userId) {
        ctx.log.warn({ eventId: event.id }, "marketing_contact_sync_skipped_missing_user");
        continue;
      }
      await enqueue({ userId, reason, eventId: event.id });
    }
    const maxId = Math.max(0, ...events.map((event) => event.id));
    if (maxId > 0) {
      await ctx.projectorStateRepo.advanceCursorLiteralName(
        MARKETING_CONTACTS_PROJECTOR,
        maxId,
        tx,
      );
    }
  });
}

export function createMarketingContactsProjector(): Projector {
  return {
    name: MARKETING_CONTACTS_PROJECTOR,
    isEnabled(ctx) {
      return ctx.enqueueMarketingContactSync != null;
    },
    async run(ctx) {
      await processMarketingContactsProjector(ctx);
    },
  };
}
