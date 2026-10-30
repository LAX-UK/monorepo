import { unsoldChoiceDueBy } from "@auction/domain";
import type { IUnsoldChoiceDeadlineStore } from "@auction/persistence/interfaces";
import type pino from "pino";
import type { ProjectorRunContext } from "./lib/projector.types.js";

export const UNSOLD_CHOICE_DEADLINE_PROJECTOR = "unsold_choice_deadline";

/**
 * Stores the date a seller must choose by when a consigned lot ends unsold, from the
 * unsold-choice window (`unsoldChoiceDueBy`). It runs on `lot.ended`, so the lifecycle code that
 * ends lots is unchanged; storing is idempotent (one date per outcome, the first kept), so a
 * replayed event changes nothing.
 */
export class UnsoldChoiceDeadlineRecorder {
  constructor(private readonly store: IUnsoldChoiceDeadlineStore) {}

  async record(lotId: string): Promise<void> {
    const outcome = await this.store.unsoldOutcomeOf(lotId);
    if (!outcome) return;
    await this.store.keep([{ ...outcome, chooseBy: unsoldChoiceDueBy(outcome.lotEndTime) }]);
  }
}

type LotEndedPayload = { outcome?: unknown };

export async function processUnsoldChoiceDeadline(options: {
  ctx: ProjectorRunContext;
  log: pino.Logger;
  recorder: Pick<UnsoldChoiceDeadlineRecorder, "record">;
}): Promise<void> {
  const { ctx, log, recorder } = options;
  const { projectorStateRepo, domainEventReader, projectorFailureRecorder } = ctx;
  const cursor = await projectorStateRepo.getCursor(UNSOLD_CHOICE_DEADLINE_PROJECTOR);
  const rows = await domainEventReader.listAfterCursor(cursor, {
    eventTypes: ["lot.ended"],
    limit: 50,
  });
  if (rows.length === 0) return;

  let maxId = cursor;
  for (const row of rows) {
    try {
      if ((row.payload as LotEndedPayload | null)?.outcome === "no_sale") {
        await recorder.record(row.aggregateId);
      }
      maxId = row.id;
    } catch (err) {
      const outcome = await projectorFailureRecorder.record({
        log,
        projectorName: UNSOLD_CHOICE_DEADLINE_PROJECTOR,
        eventId: row.id,
        err,
      });
      if (outcome.action === "skip") {
        maxId = row.id;
        continue;
      }
      return;
    }
  }
  if (maxId > cursor) {
    await projectorStateRepo.advanceCursor(UNSOLD_CHOICE_DEADLINE_PROJECTOR, maxId);
  }
}
