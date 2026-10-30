import type { Database } from "@auction/db";
import { unsoldChoiceDeadline } from "@auction/db/schema";
import { and, eq, or } from "drizzle-orm";
import type {
  IUnsoldChoiceDeadlineStore,
  UnsoldChoiceDeadline,
} from "../interfaces/unsold-lot-choice.repository.js";

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
    const rows = await this.db
      .select({
        lotId: unsoldChoiceDeadline.lotId,
        lotEndTime: unsoldChoiceDeadline.lotEndTime,
        chooseBy: unsoldChoiceDeadline.chooseBy,
      })
      .from(unsoldChoiceDeadline)
      .where(
        or(
          ...proposed.map((p) =>
            and(
              eq(unsoldChoiceDeadline.lotId, p.lotId),
              eq(unsoldChoiceDeadline.lotEndTime, p.lotEndTime),
            ),
          ),
        ),
      );
    return rows;
  }
}
