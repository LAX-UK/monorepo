import { saleNotDeleted } from "@auction/db";
import type { Database } from "@auction/db";
import { sale, saleroomSession } from "@auction/db/schema";
import type { Sale } from "@auction/types";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { AmlService } from "../aml/aml.service.js";
import type { ConditionReportService } from "../condition-report.service.js";
import type { AdminRouteServices } from "../interfaces/admin-routes.js";
import type { IRepositoryFactory } from "../interfaces/repository-factory.js";
import type { InvitationService } from "../invitation.service.js";
import type { LotFulfilmentService } from "../lot-fulfilment.service.js";
import type { SaleService } from "../sale.service.js";
import type { SourceOfFundsService } from "../source-of-funds/source-of-funds.service.js";
import type { TelephoneBidBookingService } from "../telephone-bid-booking.service.js";
import type { AdminNavCountsDeps } from "./admin-nav-counts.service.js";

export type CreateAdminNavCountsDepsInput = {
  db: Database;
  admin: AdminRouteServices;
  repoFactory: IRepositoryFactory;
  conditionReportService: ConditionReportService;
  lotFulfilmentService: LotFulfilmentService;
  saleService: SaleService;
  invitationService: InvitationService;
  amlService: AmlService;
  sourceOfFundsService: SourceOfFundsService;
  telephoneBidBookingService: TelephoneBidBookingService;
};

function saleNeedsSetup(saleRow: Sale, lotCount: number): boolean {
  if (saleRow.status !== "draft") return false;
  if (lotCount === 0) return true;
  if (!saleRow.startTime || !saleRow.endTime) return true;
  if (saleRow.deliveryMode === "onsite" && !saleRow.locationName && !saleRow.venueId) return true;
  return false;
}

function sumOnboardingIssuesFromSnapshot(snapshot: {
  entitiesPendingReviewCount: number;
  artistsPendingApprovalCount: number;
  staleKycSessionsCount: number;
  documentsAwaitingReviewCount: number;
  staleLeadOrganisationsCount: number;
}): number {
  return (
    snapshot.entitiesPendingReviewCount +
    snapshot.artistsPendingApprovalCount +
    snapshot.staleKycSessionsCount +
    snapshot.documentsAwaitingReviewCount +
    snapshot.staleLeadOrganisationsCount
  );
}

export function createAdminNavCountsDeps(input: CreateAdminNavCountsDepsInput): AdminNavCountsDeps {
  const actionableFulfilment = new Set([
    "awaiting_payment",
    "awaiting_release",
    "ready_for_collection",
    "released",
    "in_transit",
  ]);

  return {
    getSubmissionsPending: () =>
      input.admin.ops.countPendingSubmissions({ status: "under_review" }),
    getArtistsPending: async () => {
      const stats = await input.admin.catalog.getArtistStats();
      return stats.pendingReview;
    },
    getConditionReportsPending: async () => {
      const [pending, inProgress] = await Promise.all([
        input.conditionReportService.listForAdmin({
          status: "pending",
          limit: 1,
          offset: 0,
        }),
        input.conditionReportService.listForAdmin({
          status: "in_progress",
          limit: 1,
          offset: 0,
        }),
      ]);
      return pending.total + inProgress.total;
    },
    getManualReviewCount: () => input.admin.dashboard.countManualReviewPayments(),
    getOnboardingIssuesTotal: async () => {
      const snapshot = await input.admin.dashboard.getFinanceIssueSnapshot();
      return sumOnboardingIssuesFromSnapshot(snapshot);
    },
    getLotFulfilmentPending: async () => {
      const loaded = await input.lotFulfilmentService.listForAdmin({ limit: 1, offset: 0 });
      return Object.entries(loaded.statusCounts).reduce(
        (sum, [status, count]) => sum + (actionableFulfilment.has(status) ? count : 0),
        0,
      );
    },
    getWithdrawalsPending: () =>
      input.admin.dashboard.countPendingAdminReviewTasks("lot_withdrawal_request"),
    getDisputesOpen: () => input.admin.disputeCases.countOpenCases(),
    getPayoutsFailed: async () => {
      const finance = await input.admin.dashboard.getFinanceIssueSnapshot();
      return finance.failedPayoutCount;
    },
    getSaleroomLiveCount: async () => {
      const [row] = await input.db
        .select({ n: sql<number>`count(*)::int` })
        .from(saleroomSession)
        .innerJoin(sale, eq(saleroomSession.saleId, sale.id))
        .where(
          and(
            inArray(saleroomSession.status, ["live", "paused"]),
            eq(sale.status, "active"),
            saleNotDeleted(),
          ),
        );
      return row?.n ?? 0;
    },
    getInvitationsPending: async () => {
      const { pendingTotal } = await input.invitationService.listInvitations(
        {},
        { limit: 1, offset: 0 },
      );
      return pendingTotal;
    },
    getDraftSalesNeedingSetup: async () => {
      const rows = await input.saleService.list({
        status: "draft",
        needsSetup: true,
        limit: 100,
        offset: 0,
      });
      return rows.filter((row) => saleNeedsSetup(row.sale, row.lots.length)).length;
    },
    getDraftLotsMissingPhotos: () =>
      input.repoFactory.root.lot.countMatching({ status: "draft", needsPhotos: true }),
    getAmlScreeningsPending: () => input.amlService.countPendingReviews(),
    getSourceOfFundsPending: () => input.sourceOfFundsService.countPending(),
    getTelephoneBookingsPending: () => input.telephoneBidBookingService.countGlobalPending(),
  };
}
