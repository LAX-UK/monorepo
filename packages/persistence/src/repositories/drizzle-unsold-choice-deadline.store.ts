import type { Database } from "@auction/db";
import { itemSubmission, lot, unsoldChoiceDeadline } from "@auction/db/schema";
import { and, eq, inArray, isNull, or } from "drizzle-orm";
import type {
  IUnsoldChoiceDeadlineStore,
  UnsoldChoiceDeadline,
  UnsoldLotOutcomeKey,
} from "../interfaces/unsold-lot-choice.repository.js";

/** Lot states an unsold outcome ends in (the domain's `UNSOLD_LOT_END_STATUSES`). */
const UNSOLD_END_STATUSES = ["ended", "voided"] as const;

/** Keeps the first date stored for each unsold outcome; a later proposal never replaces it. */
export class DrizzleUnsoldChoiceDeadlineStore implements IUnsoldChoiceDeadlineStore {
  constructor(private readonly db: Database) {}

  async keep(proposed: readonly UnsoldChoiceDeadline[]): Promise<UnsoldChoiceDeadline[]> {
    if (proposed.length === 0) return [];
    await this.db
      .insert(unsoldChoiceDeadline)
      .values(
        proposed.map((p) => ({ lotId: p.lotId, lotEndTime: p.lotEndTime, chooseBy: p.chooseBy })),
      )
      .onConflictDoNothing();
    return this.kept(proposed);
  }

  async kept(outcomes: readonly UnsoldLotOutcomeKey[]): Promise<UnsoldChoiceDeadline[]> {
    if (outcomes.length === 0) return [];
    const rows = await this.db
      .select({
        lotId: unsoldChoiceDeadline.lotId,
        lotEndTime: unsoldChoiceDeadline.lotEndTime,
        chooseBy: unsoldChoiceDeadline.chooseBy,
      })
      .from(unsoldChoiceDeadline)
      .where(
        or(
          ...outcomes.map((p) =>
            and(
              eq(unsoldChoiceDeadline.lotId, p.lotId),
              eq(unsoldChoiceDeadline.lotEndTime, p.lotEndTime),
            ),
          ),
        ),
      );
    return rows;
  }

  async unsoldOutcomeOf(lotId: string): Promise<UnsoldLotOutcomeKey | null> {
    const [row] = await this.db
      .select({ lotId: lot.id, lotEndTime: lot.endTime })
      .from(lot)
      .innerJoin(itemSubmission, eq(itemSubmission.convertedLotId, lot.id))
      .where(
        and(eq(lot.id, lotId), isNull(lot.winnerId), inArray(lot.status, [...UNSOLD_END_STATUSES])),
      )
      .limit(1);
    return row ?? null;
  }
}
