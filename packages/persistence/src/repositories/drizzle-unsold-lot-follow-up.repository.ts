import type { Database } from "@auction/db";
import { lot, unsoldLotChoice, unsoldLotFollowUp } from "@auction/db/schema";
import { UNSOLD_LOT_END_STATUSES, relistReserveToApply, unsoldFollowUpPlan } from "@auction/domain";
import type { UnsoldLotChoiceKind, UnsoldLotFollowUp } from "@auction/types";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import type { UnsoldLotOutcomeKey } from "../interfaces/unsold-lot-choice.repository.js";
import type {
  IRelistReserveSettlement,
  IUnsoldFollowUpReader,
  IUnsoldFollowUpStore,
  IUnsoldFollowUpWriter,
  RelistReserveSettlement,
} from "../interfaces/unsold-lot-follow-up.repository.js";

type FollowUpRow = typeof unsoldLotFollowUp.$inferSelect;

function mapFollowUp(row: FollowUpRow): UnsoldLotFollowUp {
  return {
    id: row.id,
    choiceId: row.choiceId,
    lotId: row.lotId,
    lotEndTime: row.lotEndTime,
    submissionId: row.submissionId,
    kind: row.kind as UnsoldLotChoiceKind,
    reserve: row.reserve === null ? null : String(row.reserve),
    status: row.status === "done" ? "done" : "open",
    reserveAppliedAt: row.reserveAppliedAt ?? null,
    completedAt: row.completedAt ?? null,
    completedByUserId: row.completedByUserId ?? null,
    createdAt: row.createdAt,
  };
}

const outcome = (key: UnsoldLotOutcomeKey) =>
  and(eq(unsoldLotFollowUp.lotId, key.lotId), eq(unsoldLotFollowUp.lotEndTime, key.lotEndTime));

/** The staff work a confirmed unsold-lot choice leaves behind, and finishing it. */
export class DrizzleUnsoldLotFollowUpRepository
  implements
    IUnsoldFollowUpStore,
    IUnsoldFollowUpReader,
    IUnsoldFollowUpWriter,
    IRelistReserveSettlement
{
  constructor(private readonly db: Database) {}

  async openForConfirmedChoice(
    submissionId: string,
    lotId: string,
  ): Promise<UnsoldLotFollowUp | null> {
    // The choice for the outcome the lot is in now; a choice for an earlier outcome is history.
    const [choice] = await this.db
      .select({ choice: unsoldLotChoice })
      .from(unsoldLotChoice)
      .innerJoin(
        lot,
        and(eq(lot.id, unsoldLotChoice.lotId), eq(lot.endTime, unsoldLotChoice.lotEndTime)),
      )
      .where(
        and(
          eq(unsoldLotChoice.submissionId, submissionId),
          eq(unsoldLotChoice.lotId, lotId),
          eq(unsoldLotChoice.status, "confirmed"),
          isNull(lot.winnerId),
          inArray(lot.status, [...UNSOLD_LOT_END_STATUSES]),
        ),
      )
      .orderBy(desc(unsoldLotChoice.lotEndTime))
      .limit(1);
    if (!choice) return null;
    const plan = unsoldFollowUpPlan({
      decidedChoice: choice.choice.decidedChoice as UnsoldLotChoiceKind | null,
      decidedReserve:
        choice.choice.decidedReserve === null ? null : String(choice.choice.decidedReserve),
    });
    if (!plan) return null;

    await this.db
      .insert(unsoldLotFollowUp)
      .values({
        choiceId: choice.choice.id,
        lotId: choice.choice.lotId,
        lotEndTime: choice.choice.lotEndTime,
        submissionId: choice.choice.submissionId,
        legalEntityId: choice.choice.legalEntityId,
        kind: plan.kind,
        reserve: plan.reserve,
      })
      .onConflictDoNothing({ target: unsoldLotFollowUp.choiceId });
    const [row] = await this.db
      .select()
      .from(unsoldLotFollowUp)
      .where(eq(unsoldLotFollowUp.choiceId, choice.choice.id))
      .limit(1);
    return row ? mapFollowUp(row) : null;
  }

  async findForOutcome(key: UnsoldLotOutcomeKey): Promise<UnsoldLotFollowUp | null> {
    const [row] = await this.db.select().from(unsoldLotFollowUp).where(outcome(key)).limit(1);
    return row ? mapFollowUp(row) : null;
  }

  async completeByStaff(
    key: UnsoldLotOutcomeKey,
    staffUserId: string,
    at: Date,
  ): Promise<UnsoldLotFollowUp | null> {
    const [row] = await this.db
      .update(unsoldLotFollowUp)
      .set({ status: "done", completedAt: at, completedByUserId: staffUserId, updatedAt: at })
      .where(
        and(
          outcome(key),
          eq(unsoldLotFollowUp.status, "open"),
          inArray(unsoldLotFollowUp.kind, ["collect", "private_sale"]),
        ),
      )
      .returning();
    return row ? mapFollowUp(row) : null;
  }

  async settleOnReturn(
    tx: Database,
    key: UnsoldLotOutcomeKey,
    staffUserId: string,
    at: Date,
  ): Promise<RelistReserveSettlement | null> {
    const [row] = await tx
      .select()
      .from(unsoldLotFollowUp)
      .where(
        and(
          outcome(key),
          eq(unsoldLotFollowUp.kind, "relist"),
          eq(unsoldLotFollowUp.status, "open"),
        ),
      )
      .for("update")
      .limit(1);
    if (!row) return null;

    const reserve = relistReserveToApply(mapFollowUp(row));
    const [current] = await tx
      .select({ reservePrice: lot.reservePrice })
      .from(lot)
      .where(eq(lot.id, key.lotId))
      .limit(1);
    if (reserve !== null) {
      await tx.update(lot).set({ reservePrice: reserve }).where(eq(lot.id, key.lotId));
    }
    await tx
      .update(unsoldLotFollowUp)
      .set({
        status: "done",
        completedAt: at,
        completedByUserId: staffUserId,
        reserveAppliedAt: reserve === null ? null : at,
        updatedAt: at,
      })
      .where(eq(unsoldLotFollowUp.id, row.id));
    return {
      followUpId: row.id,
      previousReserve: current?.reservePrice ?? null,
      appliedReserve: reserve,
    };
  }
}
