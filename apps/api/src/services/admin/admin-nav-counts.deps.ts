import type { ILotFulfilmentRepository } from "@auction/persistence/interfaces";
import type { ISaleroomLiveSessionCounter } from "@auction/persistence/interfaces";
import type { IRepositoryFactory } from "@auction/persistence/interfaces";
import type { Sale } from "@auction/types";
import type { AmlService } from "../aml/aml.service.js";
import type { IConditionReportAdminService } from "../interfaces/condition-report.js";
import type { ILotFulfilmentService } from "../interfaces/lot-fulfilment-service.js";
import type { ISaleReadService } from "../interfaces/sale-service.js";
import type { ITelephoneBidBookingQueryService } from "../interfaces/telephone-bid-booking-service.js";
import type { SourceOfFundsService } from "../source-of-funds/source-of-funds.service.js";
import type { AdminNavCountsDeps } from "./admin-nav-counts.service.js";

export type CreateAdminNavCountsDepsInput = {
  saleroomLiveSessionCounter: ISaleroomLiveSessionCounter;
  authority: AdminNavCountsAuthorityPorts;
  repoFactory: IRepositoryFactory;
  conditionReportService: IConditionReportAdminService;
  lotFulfilmentService: ILotFulfilmentService;
  lotFulfilmentRepository: ILotFulfilmentRepository;
  saleService: ISaleReadService;
  amlService: AmlService;
  sourceOfFundsService: SourceOfFundsService;
  telephoneBidBookingService: ITelephoneBidBookingQueryService;
};

function saleNeedsSetup(saleRow: Sale, lotCount: number): boolean {
  if (saleRow.status !== "draft") return false;
  if (lotCount === 0) return true;
  if (!saleRow.startTime || !saleRow.endTime) return true;
  if (saleRow.deliveryMode === "onsite" && !saleRow.locationName && !saleRow.venueId) return true;
  return false;
}

export function createAdminNavCountsDeps(input: CreateAdminNavCountsDepsInput): AdminNavCountsDeps {
  const actionableFulfilment = new Set([
    "awaiting_payment",
    "awaiting_release",
    "ready_for_collection",
    "released",
    "in_transit",
  ]);
  const { authority } = input;

  return {
    getSubmissionsPending: () => authority.countPendingSubmissions({ status: "under_review" }),
    getArtistsPending: async () => {
      const stats = await authority.getArtistStats();
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
    getManualReviewCount: () => authority.countManualReviewPayments(),
    getOnboardingIssuesTotal: () => authority.getOnboardingQueueTotal(),
    getLotFulfilmentPending: async () => {
      const summary = await input.lotFulfilmentRepository.summarizeForAdmin();
      return Object.entries(summary.statusCounts).reduce(
        (sum, [status, count]) => sum + (actionableFulfilment.has(status) ? count : 0),
        0,
      );
    },
    getWithdrawalsPending: () => authority.countPendingAdminReviewTasks("lot_withdrawal_request"),
    getDisputesOpen: () => authority.countOpenDisputeCases(),
    getPayoutsFailed: () => authority.getFailedPayoutCount(),
    getSaleroomLiveCount: () => input.saleroomLiveSessionCounter.countLiveOrPausedOnActiveSales(),
    getInvitationsPending: () => authority.getInvitationsPendingCount(),
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
    getLegalEntityStripeRequirements: () => authority.getStripeRequirementsCount(),
  };
}

export type AdminNavCountsAuthorityPorts = {
  countPendingSubmissions: (
    filter: Omit<
      import("@auction/persistence/interfaces").ListSubmissionsFilter,
      "limit" | "offset"
    >,
  ) => Promise<number>;
  getArtistStats: () => Promise<import("@auction/types").AdminArtistStats>;
  countManualReviewPayments: () => Promise<number>;
  getOnboardingQueueTotal: () => Promise<number>;
  countPendingAdminReviewTasks: (
    kind: "lot_artist_backfill" | "lot_withdrawal_request",
  ) => Promise<number>;
  countOpenDisputeCases: () => Promise<number>;
  getFailedPayoutCount: () => Promise<number>;
  getInvitationsPendingCount: () => Promise<number>;
  getStripeRequirementsCount: () => Promise<number>;
};

export function createAdminNavCountsAuthorityPorts(
  admin: Pick<
    import("../interfaces/admin-routes.js").AdminRouteServicesCore,
    | "ops"
    | "catalog"
    | "manualReviewPayments"
    | "onboardingIssues"
    | "reviewTasks"
    | "disputeCases"
    | "financeIssueSnapshot"
    | "invitations"
  >,
): AdminNavCountsAuthorityPorts {
  return {
    countPendingSubmissions: (filter) => admin.ops.countPendingSubmissions(filter),
    getArtistStats: () => admin.catalog.getArtistStats(),
    countManualReviewPayments: () => admin.manualReviewPayments.countManualReviewPayments(),
    getOnboardingQueueTotal: async () => {
      const page = await admin.onboardingIssues.getPage({
        tab: "entities",
        limit: 1,
        offset: 0,
      });
      return page.summary.queueTotal;
    },
    countPendingAdminReviewTasks: (kind) => admin.reviewTasks.countPendingAdminReviewTasks(kind),
    countOpenDisputeCases: () => admin.disputeCases.countOpenCases(),
    getFailedPayoutCount: async () => {
      const finance = await admin.financeIssueSnapshot.getFinanceIssueSnapshot();
      return finance.failedPayoutCount;
    },
    getInvitationsPendingCount: async () => {
      const page = await admin.invitations.getPage({}, { limit: 1, offset: 0 });
      return page.summary.pending;
    },
    getStripeRequirementsCount: async () => {
      const finance = await admin.financeIssueSnapshot.getFinanceIssueSnapshot();
      return finance.legalEntitiesWithStripeConnectRequirementsCount;
    },
  };
}
