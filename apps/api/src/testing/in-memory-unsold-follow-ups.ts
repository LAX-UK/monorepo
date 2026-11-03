import type {
  IUnsoldFollowUpReader,
  IUnsoldFollowUpWriter,
  UnsoldLotOutcomeKey,
} from "@auction/persistence/interfaces";
import type { UnsoldLotFollowUp } from "@auction/types";

const keyOf = (key: UnsoldLotOutcomeKey) => `${key.lotId}@${key.lotEndTime.toISOString()}`;

/** The follow-up work in memory, with the adapter's rule that only open staff work is finished. */
export class InMemoryUnsoldFollowUps implements IUnsoldFollowUpReader, IUnsoldFollowUpWriter {
  readonly rows = new Map<string, UnsoldLotFollowUp>();

  seed(row: Partial<UnsoldLotFollowUp> & Pick<UnsoldLotFollowUp, "lotId" | "lotEndTime">) {
    this.rows.set(keyOf(row), {
      id: "follow-up-1",
      choiceId: "choice-1",
      submissionId: "submission-1",
      kind: "collect",
      reserve: null,
      status: "open",
      reserveAppliedAt: null,
      completedAt: null,
      completedByUserId: null,
      createdAt: new Date("2026-10-28T12:00:00Z"),
      ...row,
    });
  }

  async findForOutcome(key: UnsoldLotOutcomeKey) {
    return this.rows.get(keyOf(key)) ?? null;
  }

  async completeByStaff(key: UnsoldLotOutcomeKey, staffUserId: string, at: Date) {
    const row = this.rows.get(keyOf(key));
    if (!row || row.status !== "open" || row.kind === "relist") return null;
    const done = {
      ...row,
      status: "done" as const,
      completedAt: at,
      completedByUserId: staffUserId,
    };
    this.rows.set(keyOf(key), done);
    return done;
  }
}
