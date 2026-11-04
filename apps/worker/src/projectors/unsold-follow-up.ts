import type { IUnsoldFollowUpStore } from "@auction/persistence/interfaces";
import type pino from "pino";
import type { ProjectorRunContext } from "./lib/projector.types.js";

export const UNSOLD_FOLLOW_UP_PROJECTOR = "unsold_follow_up";

export const UNSOLD_CHOICE_CONFIRMED_EVENT = "submission.unsold_choice_confirmed";

type ChoiceConfirmedPayload = { submissionId?: unknown; lotId?: unknown };

/**
 * Opens the staff work for a choice a specialist confirmed (relist, arrange the return, private
 * sale). It runs on `submission.unsold_choice_confirmed`; opening is idempotent (one piece of
 * work per choice), so a replayed event changes nothing.
 */
export class UnsoldFollowUpOpener {
  constructor(private readonly store: IUnsoldFollowUpStore) {}

  async open(submissionId: string, lotId: string): Promise<void> {
    await this.store.openForConfirmedChoice(submissionId, lotId);
  }
}

export async function processUnsoldFollowUp(options: {
  ctx: ProjectorRunContext;
  log: pino.Logger;
  opener: Pick<UnsoldFollowUpOpener, "open">;
}): Promise<void> {
  const { ctx, log, opener } = options;
  const { projectorStateRepo, domainEventReader, projectorFailureRecorder } = ctx;
  const cursor = await projectorStateRepo.getCursor(UNSOLD_FOLLOW_UP_PROJECTOR);
  const rows = await domainEventReader.listAfterCursor(cursor, {
    eventTypes: [UNSOLD_CHOICE_CONFIRMED_EVENT],
    limit: 50,
  });
  if (rows.length === 0) return;

  let maxId = cursor;
  for (const row of rows) {
    try {
      const payload = row.payload as ChoiceConfirmedPayload | null;
      if (typeof payload?.submissionId === "string" && typeof payload.lotId === "string") {
        await opener.open(payload.submissionId, payload.lotId);
      }
      maxId = row.id;
    } catch (err) {
      const outcome = await projectorFailureRecorder.record({
        log,
        projectorName: UNSOLD_FOLLOW_UP_PROJECTOR,
        eventId: row.id,
        err,
      });
      if (outcome.action === "skip") {
        maxId = row.id;
        continue;
      }
      break;
    }
  }
  if (maxId > cursor) {
    await projectorStateRepo.advanceCursor(UNSOLD_FOLLOW_UP_PROJECTOR, maxId);
  }
}
