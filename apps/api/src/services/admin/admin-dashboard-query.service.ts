import type {
  AdminManualReviewPaymentRow,
  AdminOnboardingIssues,
  AdminReviewTaskRow,
} from "../../admin/admin-route-dtos.js";
import type {
  AdminLegalEntityBrowseParams,
  AdminLegalEntityBrowseResult,
} from "../../lib/admin-legal-entity-browse.js";
import type {
  FinanceIssueSnapshot,
  IAdminDashboardQueryService,
  IAdminFinanceIssueSnapshotQueryService,
  IAdminLegalEntityBrowseQueryService,
  IAdminManualReviewPaymentQueryService,
  IAdminOnboardingIssuesQueryService,
  IAdminReviewTaskQueryService,
  StripeConnectRequirementEntityRow,
} from "../interfaces/admin-routes.js";

export type AdminDashboardQueryServiceDeps = {
  financeIssueSnapshot: IAdminFinanceIssueSnapshotQueryService;
  manualReviewPayments: IAdminManualReviewPaymentQueryService;
  onboardingIssues: IAdminOnboardingIssuesQueryService;
  reviewTasks: IAdminReviewTaskQueryService;
  legalEntityBrowse: IAdminLegalEntityBrowseQueryService;
};

export class AdminDashboardQueryService implements IAdminDashboardQueryService {
  constructor(private readonly deps: AdminDashboardQueryServiceDeps) {}

  searchLegalEntitiesBrowse(
    params: AdminLegalEntityBrowseParams,
  ): Promise<AdminLegalEntityBrowseResult> {
    return this.deps.legalEntityBrowse.searchLegalEntitiesBrowse(params);
  }

  getFinanceIssueSnapshot(): Promise<FinanceIssueSnapshot> {
    return this.deps.financeIssueSnapshot.getFinanceIssueSnapshot();
  }

  getOnboardingIssues(): Promise<AdminOnboardingIssues> {
    return this.deps.onboardingIssues.getOnboardingIssues();
  }

  listStripeConnectRequirementEntities(): Promise<StripeConnectRequirementEntityRow[]> {
    return this.deps.financeIssueSnapshot.listStripeConnectRequirementEntities();
  }

  listManualReviewPayments(): Promise<AdminManualReviewPaymentRow[]> {
    return this.deps.manualReviewPayments.listManualReviewPayments();
  }

  countManualReviewPayments(): Promise<number> {
    return this.deps.manualReviewPayments.countManualReviewPayments();
  }

  listPendingAdminReviewTasks(
    kind: "lot_artist_backfill" | "lot_withdrawal_request",
  ): Promise<AdminReviewTaskRow[]> {
    return this.deps.reviewTasks.listPendingAdminReviewTasks(kind);
  }

  countPendingAdminReviewTasks(
    kind: "lot_artist_backfill" | "lot_withdrawal_request",
  ): Promise<number> {
    return this.deps.reviewTasks.countPendingAdminReviewTasks(kind);
  }
}
