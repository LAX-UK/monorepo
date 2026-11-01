import type { Database } from "@auction/db";
import {
  bidIdentityDirectory,
  consignmentAgreement,
  itemSubmission,
  legalEntityMember,
  lot,
  sale,
} from "@auction/db/schema";
import { and, eq, inArray, isNotNull, isNull, ne, sql } from "drizzle-orm";
import type {
  ConsignmentThreadFactsRecord,
  IConsignmentThreadFactsReader,
} from "../interfaces/consignment-thread-facts.reader.js";
import { legalEntityNotificationAudienceRoles } from "../interfaces/legal-entity-notification-recipient.repository.js";

export class DrizzleConsignmentThreadFactsReader implements IConsignmentThreadFactsReader {
  constructor(private readonly db: Database) {}

  async readFacts(submissionId: string): Promise<ConsignmentThreadFactsRecord | null> {
    const [row] = await this.db
      .select({
        legalEntityId: itemSubmission.legalEntityId,
        submittedByUserId: itemSubmission.submittedByUserId,
        image: sql<string | null>`(${itemSubmission.images})[1]`,
        status: itemSubmission.status,
        medium: itemSubmission.medium,
        yearOfWork: itemSubmission.yearOfWork,
        saleId: sale.id,
        saleName: sale.title,
        saleStartsAt: sale.startTime,
        lotId: lot.id,
        lotNumber: lot.lotNumber,
        estimateLow: consignmentAgreement.estimateLow,
        estimateHigh: consignmentAgreement.estimateHigh,
        reservePrice: consignmentAgreement.reservePrice,
        currency: consignmentAgreement.currency,
        proposedAt: consignmentAgreement.proposedAt,
        acceptedAt: consignmentAgreement.acceptedAt,
        senderName: bidIdentityDirectory.name,
        senderRole: legalEntityMember.role,
      })
      .from(itemSubmission)
      .leftJoin(lot, eq(lot.id, itemSubmission.convertedLotId))
      .leftJoin(sale, eq(sale.id, lot.saleId))
      .leftJoin(consignmentAgreement, eq(consignmentAgreement.submissionId, itemSubmission.id))
      .leftJoin(
        bidIdentityDirectory,
        eq(bidIdentityDirectory.subjectId, itemSubmission.submittedByUserId),
      )
      .leftJoin(
        legalEntityMember,
        and(
          eq(legalEntityMember.legalEntityId, itemSubmission.legalEntityId),
          eq(legalEntityMember.userId, itemSubmission.submittedByUserId),
          isNull(legalEntityMember.removedAt),
        ),
      )
      .where(eq(itemSubmission.id, submissionId))
      .limit(1);
    if (!row) return null;

    const admins = [...legalEntityNotificationAudienceRoles.admin];
    const [others, counted] = await Promise.all([
      this.db
        .select({ name: bidIdentityDirectory.name })
        .from(legalEntityMember)
        .innerJoin(
          bidIdentityDirectory,
          eq(bidIdentityDirectory.subjectId, legalEntityMember.userId),
        )
        .where(
          and(
            eq(legalEntityMember.legalEntityId, row.legalEntityId),
            inArray(legalEntityMember.role, admins),
            isNull(legalEntityMember.removedAt),
            isNotNull(legalEntityMember.acceptedAt),
            row.submittedByUserId ? ne(legalEntityMember.userId, row.submittedByUserId) : undefined,
          ),
        ),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(itemSubmission)
        .where(
          and(
            eq(itemSubmission.legalEntityId, row.legalEntityId),
            ne(itemSubmission.status, "draft"),
          ),
        ),
    ]);

    return {
      submission: {
        image: row.image,
        status: row.status,
        medium: row.medium,
        yearOfWork: row.yearOfWork,
      },
      sale: row.saleId
        ? { id: row.saleId, name: row.saleName ?? "A sale", startsAt: row.saleStartsAt }
        : null,
      lot: row.lotId ? { id: row.lotId, number: row.lotNumber } : null,
      agreement: row.proposedAt
        ? {
            estimateLow: row.estimateLow,
            estimateHigh: row.estimateHigh,
            reservePrice: row.reservePrice,
            currency: row.currency ?? "GBP",
            proposedAt: row.proposedAt,
            acceptedAt: row.acceptedAt,
          }
        : null,
      sender: row.senderName ? { name: row.senderName, memberRole: row.senderRole } : null,
      alsoNotified: [...new Set(others.map((other) => other.name))],
      accountConsignmentCount: Number(counted[0]?.count ?? 0),
    };
  }
}
