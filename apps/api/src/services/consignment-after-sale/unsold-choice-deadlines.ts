import { unsoldChoiceDueBy } from "@auction/domain";
import type { IUnsoldChoiceDeadlineStore } from "@auction/persistence/interfaces";

/** An unsold outcome as a list reads it: the lot, when it ended, and its stored date if any. */
export type UnsoldOutcomeDates = { lotId: string; endedAt: Date; chooseBy: Date | null };

/**
 * The date each unsold choice is due by. The window is the domain rule (`unsoldChoiceDueBy`); the
 * date is stored the first time an outcome is shown, so the date a seller was told is the date
 * that holds, whatever the window says later.
 */
export interface IUnsoldChoiceDeadlines {
  /** The due date per lot id, storing any outcome that has none yet. */
  chooseByFor(outcomes: readonly UnsoldOutcomeDates[]): Promise<Map<string, Date>>;
}

export class UnsoldChoiceDeadlines implements IUnsoldChoiceDeadlines {
  constructor(private readonly store: IUnsoldChoiceDeadlineStore) {}

  async chooseByFor(outcomes: readonly UnsoldOutcomeDates[]): Promise<Map<string, Date>> {
    const dates = new Map<string, Date>();
    const missing = [];
    for (const outcome of outcomes) {
      if (outcome.chooseBy) dates.set(outcome.lotId, outcome.chooseBy);
      else {
        missing.push({
          lotId: outcome.lotId,
          lotEndTime: outcome.endedAt,
          chooseBy: unsoldChoiceDueBy(outcome.endedAt),
        });
      }
    }
    for (const kept of await this.store.keep(missing)) dates.set(kept.lotId, kept.chooseBy);
    return dates;
  }
}
