import type { Database } from "@auction/db";
import {
  artistProfile,
  kycVerification,
  legalEntity,
  legalEntityDocument,
  payout,
} from "@auction/db/schema";
import { and, asc, eq, inArray, lt, sql } from "drizzle-orm";
import type { IAdminFinanceIssueSnapshotReader } from "../interfaces/admin-finance-issue-snapshot.reader.js";
import type { FinanceIssueSnapshot } from "../interfaces/admin-read-models.js";

export class DrizzleAdminFinanceIssueSnapshotReader implements IAdminFinanceIssueSnapshotReader {
  constructor(private readonly db: Database) {}

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

  async listStripeConnectRequirementEntities() {
    return this.db
      .select({
        id: legalEntity.id,
        displayName: legalEntity.displayName,
        status: legalEntity.status,
        stripeConnectRequirementsCurrentlyDue: legalEntity.stripeConnectRequirementsCurrentlyDue,
      })
      .from(legalEntity)
      .where(sql`jsonb_array_length(${legalEntity.stripeConnectRequirementsCurrentlyDue}) > 0`)
      .orderBy(asc(legalEntity.displayName))
      .limit(200);
  }
}
