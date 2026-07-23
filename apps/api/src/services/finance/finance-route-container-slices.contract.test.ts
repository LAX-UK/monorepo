import { describe, expect, it } from "vitest";
import type { Container } from "../../container.js";
import { defineCompileTimeContract } from "../../testing/compile-time-contract.js";
import type { ComplianceBuyerHttpRoutesContainer } from "../interfaces/compliance-routes/compliance-route-container-slices.js";
import type {
  FinanceBuyerPaymentHttpRoutesContainer,
  FinanceInternalCronRoutesContainer,
  FinancePayoutStatementRoutesContainer,
  FinanceSellerPayoutRoutesContainer,
  FinanceStripeConnectRoutesContainer,
  FinanceXeroWebhookRoutesContainer,
} from "../interfaces/finance-routes/finance-route-container-slices.js";
import type { PlatformLifecycleCronRoutesContainer } from "../interfaces/platform-cron-routes/platform-cron-route-container-slices.js";

type AssertAssignable<T extends U, U> = T;
type AssertNotAssignable<T, U> = T extends U ? never : T;

declare const container: Container;

type _StatementFromContainer = AssertAssignable<Container, FinancePayoutStatementRoutesContainer>;
type _PaymentFromContainer = AssertAssignable<Container, FinanceBuyerPaymentHttpRoutesContainer>;
type _StatementMustNotIncludeBuyerOnly = AssertNotAssignable<
  FinancePayoutStatementRoutesContainer,
  FinanceBuyerPaymentHttpRoutesContainer
>;

type _InternalCronFromContainer = AssertAssignable<Container, FinanceInternalCronRoutesContainer>;
type _LifecycleFromContainer = AssertAssignable<Container, PlatformLifecycleCronRoutesContainer>;
type _FinanceCronMustNotSeeLifecycleOnly = AssertNotAssignable<
  FinanceInternalCronRoutesContainer,
  PlatformLifecycleCronRoutesContainer
>;
type _PaymentMustNotSeeRawBuyerService = AssertNotAssignable<
  FinanceBuyerPaymentHttpRoutesContainer,
  { paymentBuyerService: unknown }
>;
type _PaymentMustNotSeeComplianceSlice = AssertNotAssignable<
  FinanceBuyerPaymentHttpRoutesContainer,
  ComplianceBuyerHttpRoutesContainer
>;
type _PaymentMustNotSeeFulfilment = AssertNotAssignable<
  FinanceBuyerPaymentHttpRoutesContainer,
  Pick<Container, "lotFulfilmentService">
>;
type _PaymentMustNotSeeMarketing = AssertNotAssignable<
  FinanceBuyerPaymentHttpRoutesContainer,
  Pick<Container, "marketingEventService">
>;

type _SellerPayoutFromContainer = AssertAssignable<Container, FinanceSellerPayoutRoutesContainer>;
type _StripeConnectFromContainer = AssertAssignable<Container, FinanceStripeConnectRoutesContainer>;
type _XeroWebhookFromContainer = AssertAssignable<Container, FinanceXeroWebhookRoutesContainer>;
type _SellerPayoutMustNotSeeRawService = AssertNotAssignable<
  FinanceSellerPayoutRoutesContainer,
  Pick<Container, "payoutService">
>;
type _StripeConnectMustNotSeeRawService = AssertNotAssignable<
  FinanceStripeConnectRoutesContainer,
  Pick<Container, "stripeConnectService">
>;
type _XeroWebhookMustNotSeeRepos = AssertNotAssignable<
  FinanceXeroWebhookRoutesContainer,
  Pick<Container, "xeroWebhookEventRepository" | "accountingProvider" | "env">
>;

type _FinanceSliceContract = [
  _StatementFromContainer,
  _PaymentFromContainer,
  _StatementMustNotIncludeBuyerOnly,
  _PaymentMustNotSeeRawBuyerService,
  _PaymentMustNotSeeComplianceSlice,
  _PaymentMustNotSeeFulfilment,
  _PaymentMustNotSeeMarketing,
  _InternalCronFromContainer,
  _LifecycleFromContainer,
  _FinanceCronMustNotSeeLifecycleOnly,
  _SellerPayoutFromContainer,
  _StripeConnectFromContainer,
  _XeroWebhookFromContainer,
  _SellerPayoutMustNotSeeRawService,
  _StripeConnectMustNotSeeRawService,
  _XeroWebhookMustNotSeeRepos,
];

defineCompileTimeContract<_FinanceSliceContract>();

describe("finance route container slices", () => {
  it("compile-time slice contracts are exported for CI typecheck", () => {
    expect(true).toBe(true);
  });
});
