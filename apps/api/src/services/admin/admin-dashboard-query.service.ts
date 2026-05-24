import type { Database } from "@auction/db";
import {
  adminReviewTask,
  artistProfile,
  domainEvent,
  kycVerification,
  legalEntity,
  legalEntityDocument,
  lot,
  payment,
  payout,
  user,
} from "@auction/db/schema";
import { and, asc, desc, eq, inArray, lt, sql } from "drizzle-orm";
import type {
  AdminManualReviewPaymentRow,
  AdminOnboardingIssues,
  AdminReviewTaskRow,
} from "../../admin/admin-route-dtos.js";
import {
  type AdminLegalEntityBrowseParams,
  searchLegalEntitiesForAdminBrowse,
} from "../../lib/admin-legal-entity-browse.js";
import type {
  FinanceIssueSnapshot,
  IAdminDashboardQueryService,
} from "../interfaces/admin-routes.js";

export class AdminDashboardQueryService implements IAdminDashboardQueryService {
  constructor(private readonly db: Database) {}

  searchLegalEntitiesBrowse(params: AdminLegalEntityBrowseParams) {
    return searchLegalEntitiesForAdminBrowse(this.db, params);
  }

  async getFinanceIssueSnapshot(): Promise<FinanceIssueSnapshot> {
    const staleKycCutoff = new Date(Date.now() - 48 * 3600 * 1000);
    const staleBlockedPayoutCutoff = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const staleLeadCutoff = new Date(Date.now() - 7 * 86_400_000);
    const [
      [failedRow],
      [dueRow],
      [staleBlockedPayoutRow],
      [entitiesPendingRow],
      [artistsPendingRow],
      [staleKycRow],
      [docsPendingRow],
      [staleLeadRow],
    ] = await Promise.all([
      this.db
        .select({ n: sql<number>`count(*)::int` })
        .from(payout)
        .where(eq(payout.status, "failed")),
      this.db
        .select({ n: sql<number>`count(*)::int` })
        .from(legalEntity)
        .where(sql`jsonb_array_length(${legalEntity.stripeConnectRequirementsCurrentlyDue}) > 0`),
      this.db
        .select({ n: sql<number>`count(*)::int` })
        .from(payout)
        .innerJoin(legalEntity, eq(payout.legalEntityId, legalEntity.id))
        .where(
          and(
            eq(payout.status, "scheduled"),
            lt(payout.createdAt, staleBlockedPayoutCutoff),
            sql`(
                ${legalEntity.stripeConnectPayoutsEnabled} = false
                OR jsonb_array_length(${legalEntity.stripeConnectRequirementsCurrentlyDue}) > 0
              )`,
          ),
        ),
      this.db
        .select({ n: sql<number>`count(*)::int` })
        .from(legalEntity)
        .where(inArray(legalEntity.status, ["docs_received", "under_review"])),
      this.db
        .select({ n: sql<number>`count(*)::int` })
        .from(artistProfile)
        .where(eq(artistProfile.status, "pending")),
      this.db
        .select({ n: sql<number>`count(*)::int` })
        .from(kycVerification)
        .where(
          and(
            inArray(kycVerification.status, ["created", "requires_input", "processing"]),
            lt(kycVerification.createdAt, staleKycCutoff),
          ),
        ),
      this.db
        .select({ n: sql<number>`count(*)::int` })
        .from(legalEntityDocument)
        .where(eq(legalEntityDocument.reviewStatus, "pending")),
      this.db
        .select({ n: sql<number>`count(*)::int` })
        .from(legalEntity)
        .where(
          and(
            eq(legalEntity.kind, "organisation"),
            eq(legalEntity.status, "lead"),
            lt(legalEntity.createdAt, staleLeadCutoff),
          ),
        ),
    ]);
    return {
      failedPayoutCount: Number(failedRow?.n ?? 0),
      legalEntitiesWithStripeConnectRequirementsCount: Number(dueRow?.n ?? 0),
      staleBlockedScheduledPayoutCount: Number(staleBlockedPayoutRow?.n ?? 0),
      entitiesPendingReviewCount: Number(entitiesPendingRow?.n ?? 0),
      artistsPendingApprovalCount: Number(artistsPendingRow?.n ?? 0),
      staleKycSessionsCount: Number(staleKycRow?.n ?? 0),
      documentsAwaitingReviewCount: Number(docsPendingRow?.n ?? 0),
      staleLeadOrganisationsCount: Number(staleLeadRow?.n ?? 0),
    };
  }

  async getOnboardingIssues(): Promise<AdminOnboardingIssues> {
    const staleKycCutoff = new Date(Date.now() - 48 * 3600 * 1000);
    const staleLeadCutoff = new Date(Date.now() - 7 * 86_400_000);
    const [entities, artists, staleKycSessions, pendingDocuments, staleLeadOrganisations] =
      await Promise.all([
        this.db
          .select({
            id: legalEntity.id,
            displayName: legalEntity.displayName,
            status: legalEntity.status,
          })
          .from(legalEntity)
          .where(inArray(legalEntity.status, ["docs_received", "under_review"]))
          .orderBy(asc(legalEntity.displayName))
          .limit(80),
        this.db
          .select({
            id: artistProfile.id,
            displayName: artistProfile.displayName,
            status: artistProfile.status,
          })
          .from(artistProfile)
          .where(eq(artistProfile.status, "pending"))
          .orderBy(asc(artistProfile.displayName))
          .limit(80),
        this.db
          .select({
            id: kycVerification.id,
            userId: kycVerification.userId,
            provider: kycVerification.provider,
            status: kycVerification.status,
            createdAt: kycVerification.createdAt,
          })
          .from(kycVerification)
          .where(
            and(
              inArray(kycVerification.status, ["created", "requires_input", "processing"]),
              lt(kycVerification.createdAt, staleKycCutoff),
            ),
          )
          .orderBy(desc(kycVerification.createdAt))
          .limit(80),
        this.db
          .select({
            id: legalEntityDocument.id,
            legalEntityId: legalEntityDocument.legalEntityId,
            entityDisplayName: legalEntity.displayName,
            uploadObjectId: legalEntityDocument.uploadObjectId,
            uploadedAt: legalEntityDocument.uploadedAt,
          })
          .from(legalEntityDocument)
          .innerJoin(legalEntity, eq(legalEntityDocument.legalEntityId, legalEntity.id))
          .where(eq(legalEntityDocument.reviewStatus, "pending"))
          .orderBy(desc(legalEntityDocument.uploadedAt))
          .limit(80),
        this.db
          .select({
            id: legalEntity.id,
            displayName: legalEntity.displayName,
            createdAt: legalEntity.createdAt,
          })
          .from(legalEntity)
          .where(
            and(
              eq(legalEntity.kind, "organisation"),
              eq(legalEntity.status, "lead"),
              lt(legalEntity.createdAt, staleLeadCutoff),
            ),
          )
          .orderBy(asc(legalEntity.createdAt))
          .limit(80),
      ]);
    return {
      entitiesPendingReview: entities as AdminOnboardingIssues["entitiesPendingReview"],
      artistsPendingApproval: artists,
      staleKycSessions: staleKycSessions,
      documentsAwaitingReview: pendingDocuments,
      staleLeadOrganisations,
    };
  }

  async listStripeConnectRequirementEntities(): Promise<
    { id: string; displayName: string; status: string }[]
  > {
    return this.db
      .select({
        id: legalEntity.id,
        displayName: legalEntity.displayName,
        status: legalEntity.status,
      })
      .from(legalEntity)
      .where(sql`jsonb_array_length(${legalEntity.stripeConnectRequirementsCurrentlyDue}) > 0`)
      .orderBy(asc(legalEntity.displayName))
      .limit(200);
  }

  async listManualReviewPayments(): Promise<AdminManualReviewPaymentRow[]> {
    const rows = await this.db
      .select({
        paymentId: payment.id,
        lotId: payment.lotId,
        lotTitle: lot.title,
        lotNumber: lot.lotNumber,
        winnerUserId: payment.buyerId,
        winnerEmail: user.email,
        sellerLegalEntityId: payment.sellerLegalEntityId,
        sellerDisplayName: legalEntity.displayName,
        sellerStatus: legalEntity.status,
        sellerArchivedAt: legalEntity.statusChangedAt,
        amount: payment.amount,
        createdAt: payment.createdAt,
      })
      .from(payment)
      .innerJoin(lot, eq(payment.lotId, lot.id))
      .innerJoin(legalEntity, eq(payment.sellerLegalEntityId, legalEntity.id))
      .innerJoin(user, eq(payment.buyerId, user.id))
      .where(sql`${payment.status} = 'requires_manual_review'`)
      .orderBy(desc(payment.createdAt))
      .limit(100);

    const data: AdminManualReviewPaymentRow[] = [];
    for (const row of rows) {
      const [archiveEvent] = await this.db
        .select({ payload: domainEvent.payload, occurredAt: domainEvent.occurredAt })
        .from(domainEvent)
        .where(
          and(
            eq(domainEvent.aggregateType, "legal_entity"),
            eq(domainEvent.aggregateId, row.sellerLegalEntityId),
            eq(domainEvent.eventType, "legal_entity.archived"),
          ),
        )
        .orderBy(desc(domainEvent.id))
        .limit(1);
      const payload = archiveEvent?.payload as { reason?: unknown } | undefined;
      data.push({
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
        archiveReason: typeof payload?.reason === "string" ? payload.reason : null,
        archiveTimestamp: row.sellerArchivedAt ?? archiveEvent?.occurredAt ?? null,
        createdAt: row.createdAt,
      });
    }
    return data;
  }

  async listPendingAdminReviewTasks(
    kind: "lot_artist_backfill" | "lot_withdrawal_request",
  ): Promise<AdminReviewTaskRow[]> {
    const kindFilter =
      kind === "lot_artist_backfill" ? "lot_artist_backfill" : "lot_withdrawal_request";
    return this.db
      .select()
      .from(adminReviewTask)
      .where(and(eq(adminReviewTask.kind, kindFilter), eq(adminReviewTask.status, "pending")))
      .orderBy(desc(adminReviewTask.createdAt))
      .limit(200);
  }
}
