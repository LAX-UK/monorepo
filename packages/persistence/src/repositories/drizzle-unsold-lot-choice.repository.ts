import type { Database } from "@auction/db";
import { itemSubmission, lot, unsoldChoiceDeadline, unsoldLotChoice } from "@auction/db/schema";
import type { UnsoldLotChoice, UnsoldLotChoiceKind, UnsoldLotChoiceStatus } from "@auction/types";
import { and, asc, count, desc, eq, inArray, isNull } from "drizzle-orm";
import type {
  IUnsoldLotChoiceRepository,
  OpenUnsoldLotChoice,
  UnsoldLotChoiceDecisionRow,
  UnsoldLotChoiceRequestRow,
  UnsoldLotOutcomeKey,
  UnsoldOutcomeListFilter,
  UnsoldOutcomeRow,
} from "../interfaces/unsold-lot-choice.repository.js";
import { submissionSenderSql } from "./submission-sender.sql.js";

type ChoiceRow = typeof unsoldLotChoice.$inferSelect;

function money(value: string | null): string | null {
  return value === null ? null : String(value);
}

function kind(value: string | null): UnsoldLotChoiceKind | null {
  return value as UnsoldLotChoiceKind | null;
}

function mapChoice(row: ChoiceRow): UnsoldLotChoice {
  return {
    id: row.id,
    lotId: row.lotId,
    submissionId: row.submissionId,
    legalEntityId: row.legalEntityId,
    lotEndTime: row.lotEndTime,
    status: row.status as UnsoldLotChoiceStatus,
    requestedChoice: kind(row.requestedChoice),
    requestedReserve: money(row.requestedReserve),
    requestedByUserId: row.requestedByUserId ?? null,
    requestedAt: row.requestedAt ?? null,
    decidedChoice: kind(row.decidedChoice),
    decidedReserve: money(row.decidedReserve),
    decidedByUserId: row.decidedByUserId ?? null,
    decidedAt: row.decidedAt ?? null,
    staffNote: row.staffNote ?? null,
    currency: row.currency,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

const outcome = (key: UnsoldLotOutcomeKey) =>
  and(eq(unsoldLotChoice.lotId, key.lotId), eq(unsoldLotChoice.lotEndTime, key.lotEndTime));

export class DrizzleUnsoldLotChoiceRepository implements IUnsoldLotChoiceRepository {
  constructor(private readonly db: Database) {}

  async findForOutcome(key: UnsoldLotOutcomeKey): Promise<UnsoldLotChoice | null> {
    const [row] = await this.db.select().from(unsoldLotChoice).where(outcome(key)).limit(1);
    return row ? mapChoice(row) : null;
  }

  async listOpenRequests(limit: number): Promise<OpenUnsoldLotChoice[]> {
    const rows = await this.db
      .select({
        id: unsoldLotChoice.id,
        lotId: unsoldLotChoice.lotId,
        submissionId: unsoldLotChoice.submissionId,
        lotTitle: lot.title,
        requestedChoice: unsoldLotChoice.requestedChoice,
        requestedAt: unsoldLotChoice.requestedAt,
      })
      .from(unsoldLotChoice)
      .innerJoin(lot, eq(lot.id, unsoldLotChoice.lotId))
      .where(eq(unsoldLotChoice.status, "requested"))
      .orderBy(asc(unsoldLotChoice.requestedAt))
      .limit(limit);
    return rows.map((row) => ({ ...row, requestedChoice: kind(row.requestedChoice) }));
  }

  async listUnsoldOutcomes(
    filter: UnsoldOutcomeListFilter,
  ): Promise<{ rows: UnsoldOutcomeRow[]; total: number }> {
    // The choice for the lot's latest outcome: a relisted lot that ends unsold again starts afresh.
    const choiceJoin = and(
      eq(unsoldLotChoice.lotId, lot.id),
      eq(unsoldLotChoice.lotEndTime, lot.endTime),
    );
    const parts = [
      eq(itemSubmission.legalEntityId, filter.legalEntityId),
      inArray(lot.status, [...filter.endedStatuses]),
      isNull(lot.winnerId),
    ];
    const sender = submissionSenderSql(filter.visibleTo);
    if (sender) parts.push(sender);
    if (filter.choice === "none") parts.push(isNull(unsoldLotChoice.id));
    else if (filter.choice) parts.push(eq(unsoldLotChoice.status, filter.choice));
    const where = and(...parts);

    const [rows, [counted]] = await Promise.all([
      this.db
        .select({
          lotId: lot.id,
          submissionId: itemSubmission.id,
          title: lot.title,
          endedAt: lot.endTime,
          chooseBy: unsoldChoiceDeadline.chooseBy,
          choice: unsoldLotChoice.status,
        })
        .from(itemSubmission)
        .innerJoin(lot, eq(lot.id, itemSubmission.convertedLotId))
        .leftJoin(unsoldLotChoice, choiceJoin)
        .leftJoin(
          unsoldChoiceDeadline,
          and(
            eq(unsoldChoiceDeadline.lotId, lot.id),
            eq(unsoldChoiceDeadline.lotEndTime, lot.endTime),
          ),
        )
        .where(where)
        .orderBy(desc(lot.endTime), asc(lot.id))
        .limit(filter.limit)
        .offset(filter.offset),
      this.db
        .select({ n: count() })
        .from(itemSubmission)
        .innerJoin(lot, eq(lot.id, itemSubmission.convertedLotId))
        .leftJoin(unsoldLotChoice, choiceJoin)
        .where(where),
    ]);
    return {
      rows: rows.map((row) => ({
        ...row,
        choice: (row.choice as UnsoldLotChoiceStatus | null) ?? null,
      })),
      total: Number(counted?.n ?? 0),
    };
  }

  async countOpenRequests(): Promise<number> {
    const [row] = await this.db
      .select({ n: count() })
      .from(unsoldLotChoice)
      .where(eq(unsoldLotChoice.status, "requested"));
    return Number(row?.n ?? 0);
  }

  async saveRequest(row: UnsoldLotChoiceRequestRow): Promise<UnsoldLotChoice | null> {
    const request = {
      requestedChoice: row.choice,
      requestedReserve: row.reserve,
      requestedByUserId: row.requestedByUserId,
      requestedAt: row.requestedAt,
      updatedAt: row.requestedAt,
    };
    await this.db
      .insert(unsoldLotChoice)
      .values({
        lotId: row.lotId,
        lotEndTime: row.lotEndTime,
        submissionId: row.submissionId,
        legalEntityId: row.legalEntityId,
        currency: row.currency,
        status: "requested",
        ...request,
      })
      .onConflictDoUpdate({
        target: [unsoldLotChoice.lotId, unsoldLotChoice.lotEndTime],
        set: request,
        // A confirmed choice is a record; the seller cannot change it afterwards.
        setWhere: eq(unsoldLotChoice.status, "requested"),
      });
    const stored = await this.findForOutcome(row);
    return stored && stored.status === "requested" ? stored : null;
  }

  async saveDecision(row: UnsoldLotChoiceDecisionRow): Promise<UnsoldLotChoice | null> {
    const decision = {
      status: "confirmed",
      decidedChoice: row.choice,
      decidedReserve: row.reserve,
      decidedByUserId: row.decidedByUserId,
      decidedAt: row.decidedAt,
      staffNote: row.note,
      updatedAt: row.decidedAt,
    };
    const written = await this.db
      .insert(unsoldLotChoice)
      .values({
        lotId: row.lotId,
        lotEndTime: row.lotEndTime,
        submissionId: row.submissionId,
        legalEntityId: row.legalEntityId,
        currency: row.currency,
        ...decision,
      })
      .onConflictDoUpdate({
        target: [unsoldLotChoice.lotId, unsoldLotChoice.lotEndTime],
        set: decision,
        setWhere: eq(unsoldLotChoice.status, "requested"),
      })
      .returning({ id: unsoldLotChoice.id });
    if (written.length === 0) return null;
    return this.findForOutcome(row);
  }
}
