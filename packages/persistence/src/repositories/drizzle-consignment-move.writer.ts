import type { Database } from "@auction/db";
import { consignmentAgreement, itemSubmission } from "@auction/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import type {
  ConsignmentMoveRow,
  IConsignmentMoveWriter,
} from "../interfaces/consignment-move.writer.js";

export class DrizzleConsignmentMoveWriter implements IConsignmentMoveWriter {
  constructor(private readonly db: Database) {}

  async move(row: ConsignmentMoveRow): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const moved = await tx
        .update(itemSubmission)
        .set({
          legalEntityId: row.toLegalEntityId,
          updatedAt: row.movedAt,
          ...(row.sellerUserId
            ? {
                submittedByUserId: sql`coalesce(${itemSubmission.submittedByUserId}, ${row.sellerUserId})`,
              }
            : {}),
        })
        .where(
          and(
            eq(itemSubmission.id, row.submissionId),
            eq(itemSubmission.legalEntityId, row.fromLegalEntityId),
            inArray(itemSubmission.status, [...row.movableStatuses]),
          ),
        )
        .returning({ id: itemSubmission.id });
      if (moved.length === 0) return false;
      await tx
        .update(consignmentAgreement)
        .set({
          legalEntityId: row.toLegalEntityId,
          updatedAt: row.movedAt,
          ...(row.resetAgreementAcceptance
            ? {
                acceptedAt: null,
                acceptedByUserId: null,
                proposedAt: row.movedAt,
                reminderDay3SentAt: null,
                reminderDay7SentAt: null,
              }
            : {}),
        })
        .where(eq(consignmentAgreement.submissionId, row.submissionId));
      return true;
    });
  }
}
