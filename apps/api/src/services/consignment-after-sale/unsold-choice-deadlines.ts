import { unsoldChoiceDueBy } from "@auction/domain";

/** An unsold outcome as a list reads it: the lot, when it ended, and its stored date if any. */
export type UnsoldOutcomeDates = { lotId: string; endedAt: Date; chooseBy: Date | null };

/**
 * The date each unsold choice is due by. The worker stores it when the lot ends unsold (the
 * `unsold_choice_deadline` projector), from the window rule `unsoldChoiceDueBy`; reads only read.
 * An outcome with no stored date yet (the projector has not run) gets the same rule's date, so the
 * seller sees the date that will be stored, and the gap is logged at debug level.
 */
export interface IUnsoldChoiceDeadlines {
  /** The due date per lot id. */
  chooseByFor(outcomes: readonly UnsoldOutcomeDates[]): Map<string, Date>;
}

/** The slice of the structured logger this reads with (fields first, then the message). */
export type UnsoldChoiceDeadlinesLog = {
  debug(fields: { lotIds: string[]; count: number }, message: string): void;
};

export class UnsoldChoiceDeadlines implements IUnsoldChoiceDeadlines {
  constructor(private readonly log: UnsoldChoiceDeadlinesLog) {}

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
      // Expected for lots that ended before the projector ran, so it is a debug line, once per call.
      this.log.debug(
        { lotIds: missing, count: missing.length },
        "unsold_choice_deadline_window_rule_fallback",
      );
    }
    return dates;
  }
}
