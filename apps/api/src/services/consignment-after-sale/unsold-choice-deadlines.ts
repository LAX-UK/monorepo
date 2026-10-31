import { unsoldChoiceDueBy } from "@auction/domain";

/** An unsold outcome as a list reads it: the lot, when it ended, and its stored date if any. */
export type UnsoldOutcomeDates = { lotId: string; endedAt: Date; chooseBy: Date | null };

/**
 * The date each unsold choice is due by. The worker stores it when the lot ends unsold (the
 * `unsold_choice_deadline` projector), from the window rule `unsoldChoiceDueBy`; reads only read.
 * An outcome with no stored date yet (the projector has not run) gets the same rule's date, so the
 * seller sees the date that will be stored, and the gap is logged.
 */
export interface IUnsoldChoiceDeadlines {
  /** The due date per lot id. */
  chooseByFor(outcomes: readonly UnsoldOutcomeDates[]): Map<string, Date>;
}

export class UnsoldChoiceDeadlines implements IUnsoldChoiceDeadlines {
  constructor(
    private readonly log: { warn(message: string, meta: Record<string, unknown>): void } = {
      warn: (message, meta) => console.warn(message, meta),
    },
  ) {}

  chooseByFor(outcomes: readonly UnsoldOutcomeDates[]): Map<string, Date> {
    const dates = new Map<string, Date>();
    const missing: string[] = [];
    for (const outcome of outcomes) {
      if (outcome.chooseBy) dates.set(outcome.lotId, outcome.chooseBy);
      else {
        missing.push(outcome.lotId);
        dates.set(outcome.lotId, unsoldChoiceDueBy(outcome.endedAt));
      }
    }
    if (missing.length > 0) {
      this.log.warn("[unsold-choice-deadlines] no stored date yet; using the window rule", {
        lotIds: missing,
      });
    }
    return dates;
  }
}
