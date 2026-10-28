import type { Database } from "@auction/db";
import { consignmentAgreement, itemSubmission } from "@auction/db/schema";
import type { AgreementReminderDay } from "@auction/domain";
import type { ConsignmentAgreement } from "@auction/types";
import { and, asc, eq, inArray, isNotNull, isNull, lte, sql } from "drizzle-orm";
import type {
  AwaitingConsignmentAgreement,
  ConsignmentAgreementProposalRow,
  IConsignmentAgreementRepository,
} from "../interfaces/consignment-agreement.repository.js";

type AgreementRow = typeof consignmentAgreement.$inferSelect;

function money(value: string | null): string | null {
  return value === null ? null : String(value);
}

function mapAgreement(row: AgreementRow): ConsignmentAgreement {
  return {
    id: row.id,
    submissionId: row.submissionId,
    legalEntityId: row.legalEntityId,
    termsVersion: row.termsVersion,
    estimateLow: money(row.estimateLow),
    estimateHigh: money(row.estimateHigh),
    reservePrice: money(row.reservePrice),
    commissionPercent: money(row.commissionPercent),
    currency: row.currency,
    proposedAt: row.proposedAt,
    acceptedAt: row.acceptedAt ?? null,
    acceptedByUserId: row.acceptedByUserId ?? null,
  };
}

export class DrizzleConsignmentAgreementRepository implements IConsignmentAgreementRepository {
  constructor(private readonly db: Database) {}

  async findBySubmissionId(submissionId: string): Promise<ConsignmentAgreement | null> {
    const [row] = await this.db
      .select()
      .from(consignmentAgreement)
      .where(eq(consignmentAgreement.submissionId, submissionId))
      .limit(1);
    return row ? mapAgreement(row) : null;
  }

  async listByLegalEntity(legalEntityId: string): Promise<ConsignmentAgreement[]> {
    const rows = await this.db
      .select()
      .from(consignmentAgreement)
      .where(eq(consignmentAgreement.legalEntityId, legalEntityId));
    return rows.map(mapAgreement);
  }

  async listBySubmissionIds(submissionIds: readonly string[]): Promise<ConsignmentAgreement[]> {
    if (submissionIds.length === 0) return [];
    const rows = await this.db
      .select()
      .from(consignmentAgreement)
      .where(inArray(consignmentAgreement.submissionId, [...submissionIds]));
    return rows.map(mapAgreement);
  }

  async listAwaiting(proposedBefore: Date, limit: number): Promise<AwaitingConsignmentAgreement[]> {
    const rows = await this.db
      .select({
        id: consignmentAgreement.id,
        submissionId: consignmentAgreement.submissionId,
        legalEntityId: consignmentAgreement.legalEntityId,
        submissionTitle: itemSubmission.title,
        proposedAt: consignmentAgreement.proposedAt,
        reminderDay3SentAt: consignmentAgreement.reminderDay3SentAt,
        reminderDay7SentAt: consignmentAgreement.reminderDay7SentAt,
      })
      .from(consignmentAgreement)
      .innerJoin(itemSubmission, eq(itemSubmission.id, consignmentAgreement.submissionId))
      .where(
        and(
          isNull(consignmentAgreement.acceptedAt),
          isNull(consignmentAgreement.reminderDay7SentAt),
          eq(itemSubmission.status, "approved"),
          isNotNull(consignmentAgreement.estimateLow),
          isNotNull(consignmentAgreement.estimateHigh),
          isNotNull(consignmentAgreement.commissionPercent),
          lte(consignmentAgreement.proposedAt, proposedBefore),
        ),
      )
      .orderBy(asc(consignmentAgreement.proposedAt))
      .limit(limit);
    return rows.map((row) => ({ ...row, acceptedAt: null }));
  }

  async propose(row: ConsignmentAgreementProposalRow): Promise<ConsignmentAgreement> {
    const values = {
      submissionId: row.submissionId,
      legalEntityId: row.legalEntityId,
      termsVersion: row.termsVersion,
      estimateLow: row.estimateLow,
      estimateHigh: row.estimateHigh,
      reservePrice: row.reservePrice,
      commissionPercent: row.commissionPercent,
      currency: row.currency,
      proposedByUserId: row.proposedByUserId,
      proposedAt: row.proposedAt,
      updatedAt: row.proposedAt,
    };
    await this.db
      .insert(consignmentAgreement)
      .values(values)
      .onConflictDoUpdate({
        target: consignmentAgreement.submissionId,
        set: { ...values, reminderDay3SentAt: null, reminderDay7SentAt: null },
        // An accepted agreement is a record; a new proposal never rewrites it.
        setWhere: isNull(consignmentAgreement.acceptedAt),
      });
    const stored = await this.findBySubmissionId(row.submissionId);
    if (!stored) throw new Error("consignment_agreement_propose_failed");
    return stored;
  }

  async accept(input: {
    submissionId: string;
    acceptedByUserId: string;
    acceptedAt: Date;
  }): Promise<ConsignmentAgreement | null> {
    await this.db
      .update(consignmentAgreement)
      .set({
        acceptedAt: input.acceptedAt,
        acceptedByUserId: input.acceptedByUserId,
        updatedAt: input.acceptedAt,
      })
      .where(
        and(
          eq(consignmentAgreement.submissionId, input.submissionId),
          isNull(consignmentAgreement.acceptedAt),
        ),
      );
    return this.findBySubmissionId(input.submissionId);
  }

  async markReminderSent(id: string, day: AgreementReminderDay, sentAt: Date): Promise<boolean> {
    const column =
      day === 3 ? consignmentAgreement.reminderDay3SentAt : consignmentAgreement.reminderDay7SentAt;
    const set =
      day === 3
        ? { reminderDay3SentAt: sentAt }
        : // The day 7 reminder covers a missed day 3 one; never send that afterwards.
          {
            reminderDay7SentAt: sentAt,
            reminderDay3SentAt: sql`coalesce(${consignmentAgreement.reminderDay3SentAt}, ${sentAt})`,
          };
    const updated = await this.db
      .update(consignmentAgreement)
      .set({ ...set, updatedAt: sentAt })
      .where(
        and(
          eq(consignmentAgreement.id, id),
          isNull(column),
          isNull(consignmentAgreement.acceptedAt),
        ),
      )
      .returning({ id: consignmentAgreement.id });
    return updated.length > 0;
  }
}
