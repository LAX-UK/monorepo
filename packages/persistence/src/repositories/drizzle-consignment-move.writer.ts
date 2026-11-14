import type { Database } from "@auction/db";
import { consignmentAgreement, itemSubmission } from "@auction/db/schema";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type {
  ConsignmentMoveRow,
  IConsignmentMoveWriter,
} from "../interfaces/consignment-move.writer.js";
import { supersedeAgreement } from "./agreement-version.js";

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
      const [agreement] = await tx
        .select()
        .from(consignmentAgreement)
        .where(
          and(
            eq(consignmentAgreement.submissionId, row.submissionId),
            isNull(consignmentAgreement.supersededAt),
          ),
        )
        .for("update")
        .limit(1);
      if (!agreement) return true;
      const changes = {
        legalEntityId: row.toLegalEntityId,
        ...(row.resetAgreementAcceptance
          ? { acceptedAt: null, acceptedByUserId: null, proposedAt: row.movedAt }
          : {}),
      };
      // A signed agreement moves as its next version, so the one the seller signed stays on record.
      if (agreement.acceptedAt !== null) {
        await supersedeAgreement(tx, agreement, changes, row.movedAt);
        return true;
      }
      await tx
        .update(consignmentAgreement)
        .set({
          ...changes,
          updatedAt: row.movedAt,
          ...(row.resetAgreementAcceptance
            ? { reminderDay3SentAt: null, reminderDay7SentAt: null }
            : {}),
        })
        .where(eq(consignmentAgreement.id, agreement.id));
      return true;
    });
  }
}
