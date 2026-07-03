import { describe, expect, it } from "vitest";
import { defineCompileTimeContract } from "../../testing/compile-time-contract.js";
import type {
  IAdminDashboardQueryService,
  IAdminFinanceDashboardQueryService,
  IAdminFinanceIssueSnapshotQueryService,
  IAdminLegalEntityBrowseQueryService,
  IAdminManualReviewPaymentQueryService,
  IAdminOnboardingIssuesQueryService,
  IAdminReviewTaskQueryService,
} from "../interfaces/admin-routes.js";
import type { AdminDashboardQueryService } from "./admin-dashboard-query.service.js";

/**
 * Compile-time LSP contract: the migration facade must remain substitutable for
 * every segregated interface (identical public method surface at the type level).
 */
type AssertAssignable<T extends U, U> = T;

declare const facade: AdminDashboardQueryService;

type _Composite = AssertAssignable<typeof facade, IAdminDashboardQueryService>;
type _Finance = AssertAssignable<typeof facade, IAdminFinanceDashboardQueryService>;
type _FinanceIssueSnapshot = AssertAssignable<
  typeof facade,
  IAdminFinanceIssueSnapshotQueryService
>;
type _ManualReviewPayments = AssertAssignable<typeof facade, IAdminManualReviewPaymentQueryService>;
type _OnboardingIssues = AssertAssignable<typeof facade, IAdminOnboardingIssuesQueryService>;
type _ReviewTasks = AssertAssignable<typeof facade, IAdminReviewTaskQueryService>;
type _LegalEntityBrowse = AssertAssignable<typeof facade, IAdminLegalEntityBrowseQueryService>;

type _FacadeContract = [
  _Composite,
  _Finance,
  _FinanceIssueSnapshot,
  _ManualReviewPayments,
  _OnboardingIssues,
  _ReviewTasks,
  _LegalEntityBrowse,
];

defineCompileTimeContract<_FacadeContract>();

describe("AdminDashboardQueryService facade contract", () => {
  it("compile-time LSP types are exported for CI typecheck", () => {
    expect(true).toBe(true);
  });
});
