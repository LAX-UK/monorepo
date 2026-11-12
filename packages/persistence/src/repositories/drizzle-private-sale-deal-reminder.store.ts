import type { Database } from "@auction/db";
import {
  itemSubmission,
  privateSaleDeal,
  privateSaleDealParty,
  privateSaleDealReminder,
} from "@auction/db/schema";
import {
  type DealDeadlineKind,
  type PaymentReminderStep,
  dealPaymentDueMinor,
} from "@auction/domain";
import type { PrivateSaleDealStage } from "@auction/types";
import { and, asc, eq, gt, inArray, isNotNull, sql } from "drizzle-orm";
import type {
  DealReminderCandidate,
  IPrivateSaleDealReminderStore,
} from "../interfaces/private-sale-deal-reminder.store.js";

/** The stage a deal waits in for each deadline, and the column that holds the deadline. */
const DEADLINES = [
  { kind: "payment", stage: "invoiced", due: privateSaleDeal.paymentDueAt },
  { kind: "collection", stage: "paid", due: privateSaleDeal.collectionDueAt },
] as const;

/**
 * The last step closes with the London day three days after the deadline, so a deadline more than
 * four days past has nothing left to send. The bound is five days so that the autumn clock change
 * (a 25-hour London day) cannot shorten the window for a deadline in the first hour of a London
 * day; the send-time guard rules out late sends. Leaving older deals out keeps them from filling
 * the batch. A deadline just after London midnight has a very short due-day window, so that
 * reminder is claimed unsent if a poll is late; snapping deadlines to the end of the day would fix it.
 */
const LAST_STEP_TAIL_DAYS = 5;

/** Which deals have a deadline to remind the buyer of, and which reminders have gone out. */
export class DrizzlePrivateSaleDealReminderStore implements IPrivateSaleDealReminderStore {
  constructor(private readonly db: Database) {}

  async listCandidates(limit: number): Promise<DealReminderCandidate[]> {
    const lists = await Promise.all(DEADLINES.map((deadline) => this.listFor(deadline, limit)));
    return lists
      .flat()
      .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())
      .slice(0, limit);
  }

  async claim(dealId: string, kind: DealDeadlineKind, step: PaymentReminderStep): Promise<boolean> {
    const rows = await this.db
      .insert(privateSaleDealReminder)
      .values({ dealId, kind, step })
      .onConflictDoNothing()
      .returning({ id: privateSaleDealReminder.id });
    return rows.length > 0;
  }

  async release(dealId: string, kind: DealDeadlineKind, step: PaymentReminderStep): Promise<void> {
    await this.db
      .delete(privateSaleDealReminder)
      .where(
        and(
          eq(privateSaleDealReminder.dealId, dealId),
          eq(privateSaleDealReminder.kind, kind),
          eq(privateSaleDealReminder.step, step),
        ),
      );
  }

  private async listFor(
    deadline: (typeof DEADLINES)[number],
    limit: number,
  ): Promise<DealReminderCandidate[]> {
    const rows = await this.db
      .select({
        dealId: privateSaleDeal.id,
        reference: privateSaleDeal.reference,
        stage: privateSaleDeal.stage,
        dueAt: deadline.due,
        priceMinor: privateSaleDeal.priceMinor,
        buyerFeeBps: privateSaleDeal.buyerFeeBps,
        buyerLegalEntityId: privateSaleDealParty.legalEntityId,
        buyerUserId: privateSaleDealParty.actingUserId,
        workTitle: itemSubmission.title,
      })
      .from(privateSaleDeal)
      .innerJoin(
        privateSaleDealParty,
        and(
          eq(privateSaleDealParty.dealId, privateSaleDeal.id),
          eq(privateSaleDealParty.role, "buyer"),
        ),
      )
      .innerJoin(itemSubmission, eq(itemSubmission.id, privateSaleDeal.itemSubmissionId))
      .where(
        and(
          eq(privateSaleDeal.stage, deadline.stage),
          isNotNull(deadline.due),
          gt(deadline.due, sql`now() - make_interval(days => ${LAST_STEP_TAIL_DAYS})`),
        ),
      )
      .orderBy(asc(deadline.due))
      .limit(limit);
    if (rows.length === 0) return [];

    const sent = await this.db
      .select({ dealId: privateSaleDealReminder.dealId, step: privateSaleDealReminder.step })
      .from(privateSaleDealReminder)
      .where(
        and(
          eq(privateSaleDealReminder.kind, deadline.kind),
          inArray(
            privateSaleDealReminder.dealId,
            rows.map((row) => row.dealId),
          ),
        ),
      );
    return rows.flatMap((row) =>
      row.dueAt && row.buyerUserId
        ? [
            {
              dealId: row.dealId,
              reference: row.reference,
              stage: row.stage as PrivateSaleDealStage,
              kind: deadline.kind,
              dueAt: row.dueAt,
              buyerLegalEntityId: row.buyerLegalEntityId,
              buyerUserId: row.buyerUserId,
              workTitle: row.workTitle,
              amountDueMinor: dealPaymentDueMinor(row),
              sentSteps: sent
                .filter((entry) => entry.dealId === row.dealId)
                .map((entry) => entry.step as PaymentReminderStep),
            },
          ]
        : [],
    );
  }
}
