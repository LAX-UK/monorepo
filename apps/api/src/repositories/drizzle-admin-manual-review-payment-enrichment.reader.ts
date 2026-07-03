import type { Database } from "@auction/db";
import { domainEvent, sourceOfFunds } from "@auction/db/schema";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { AdminManualReviewPaymentRow } from "../admin/admin-route-dtos.js";
import type { ManualReviewPaymentBaseRow } from "../services/admin/manual-review-payment-enricher.js";
import type { IAdminManualReviewPaymentEnrichmentReader } from "./interfaces/admin-manual-review-payment-enrichment.reader.js";

const MANUAL_REVIEW_REASONS = new Set<
  NonNullable<AdminManualReviewPaymentRow["manualReviewReason"]>
>([
  "seller_archived",
  "high_value",
  "seller_archived_and_high_value",
  "aml_hold",
  "source_of_funds_required",
]);

function parseManualReviewReason(
  payload: unknown,
): AdminManualReviewPaymentRow["manualReviewReason"] {
  const reason = (payload as { reason?: unknown } | undefined)?.reason;
  return typeof reason === "string" && MANUAL_REVIEW_REASONS.has(reason as never)
    ? (reason as AdminManualReviewPaymentRow["manualReviewReason"])
    : null;
}

type DomainEventSnapshot = {
  payload: unknown;
  occurredAt: Date;
};

export class DrizzleAdminManualReviewPaymentEnrichmentReader
  implements IAdminManualReviewPaymentEnrichmentReader
{
  constructor(private readonly db: Database) {}

  async enrich(rows: ManualReviewPaymentBaseRow[]): Promise<AdminManualReviewPaymentRow[]> {
    if (rows.length === 0) return [];

    const sellerIds = [...new Set(rows.map((row) => row.sellerLegalEntityId))];
    const paymentIds = rows.map((row) => row.paymentId);

    const [archiveEvents, reviewEvents] = await Promise.all([
      sellerIds.length > 0
        ? this.db
            .select({
              aggregateId: domainEvent.aggregateId,
              payload: domainEvent.payload,
              occurredAt: domainEvent.occurredAt,
              id: domainEvent.id,
            })
            .from(domainEvent)
            .where(
              and(
                eq(domainEvent.aggregateType, "legal_entity"),
                inArray(domainEvent.aggregateId, sellerIds),
                eq(domainEvent.eventType, "legal_entity.archived"),
              ),
            )
            .orderBy(desc(domainEvent.id))
        : Promise.resolve([]),
      paymentIds.length > 0
        ? this.db
            .select({
              aggregateId: domainEvent.aggregateId,
              payload: domainEvent.payload,
              id: domainEvent.id,
            })
            .from(domainEvent)
            .where(
              and(
                eq(domainEvent.aggregateType, "payment"),
                inArray(domainEvent.aggregateId, paymentIds),
                eq(domainEvent.eventType, "payment.requires_manual_review"),
              ),
            )
            .orderBy(desc(domainEvent.id))
        : Promise.resolve([]),
    ]);

    const archiveBySeller = new Map<string, DomainEventSnapshot>();
    for (const event of archiveEvents) {
      if (!archiveBySeller.has(event.aggregateId)) {
        archiveBySeller.set(event.aggregateId, {
          payload: event.payload,
          occurredAt: event.occurredAt,
        });
      }
    }

    const reviewByPayment = new Map<string, unknown>();
    for (const event of reviewEvents) {
      if (!reviewByPayment.has(event.aggregateId)) {
        reviewByPayment.set(event.aggregateId, event.payload);
      }
    }

    const data: AdminManualReviewPaymentRow[] = rows.map((row) => {
      const archiveEvent = archiveBySeller.get(row.sellerLegalEntityId);
      const archivePayload = archiveEvent?.payload as { reason?: unknown } | undefined;
      const manualReviewReason = parseManualReviewReason(reviewByPayment.get(row.paymentId));
      return {
        paymentId: row.paymentId,
        lotId: row.lotId,
        lotTitle: row.lotTitle,
        lotNumber: row.lotNumber,
        winnerUserId: row.winnerUserId,
        winnerEmail: row.winnerEmail,
        sellerLegalEntityId: row.sellerLegalEntityId,
        sellerDisplayName: row.sellerDisplayName,
        sellerStatus: row.sellerStatus,
        sellerArchivedAt: row.sellerArchivedAt,
        amount: String(row.amount),
        currency: "GBP",
        archiveReason: typeof archivePayload?.reason === "string" ? archivePayload.reason : null,
        archiveTimestamp: row.sellerArchivedAt ?? archiveEvent?.occurredAt ?? null,
        manualReviewReason,
        sourceOfFundsCaseId: null,
        createdAt: row.createdAt,
      };
    });

    const sofUserIds = [
      ...new Set(
        data
          .filter((row) => row.manualReviewReason === "source_of_funds_required")
          .map((row) => row.winnerUserId),
      ),
    ];
    if (sofUserIds.length === 0) return data;

    const pendingCases = await this.db
      .select({
        id: sourceOfFunds.id,
        userId: sourceOfFunds.userId,
        createdAt: sourceOfFunds.createdAt,
      })
      .from(sourceOfFunds)
      .where(and(inArray(sourceOfFunds.userId, sofUserIds), eq(sourceOfFunds.status, "pending")))
      .orderBy(asc(sourceOfFunds.createdAt));

    const caseByUser = new Map<string, string>();
    for (const pendingCase of pendingCases) {
      if (!caseByUser.has(pendingCase.userId)) {
        caseByUser.set(pendingCase.userId, pendingCase.id);
      }
    }

    for (const row of data) {
      if (row.manualReviewReason === "source_of_funds_required") {
        row.sourceOfFundsCaseId = caseByUser.get(row.winnerUserId) ?? null;
      }
    }

    return data;
  }
}
