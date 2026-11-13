import type { IPayoutRepository, IUserRepository } from "@auction/persistence/interfaces";
import type {
  IPaymentExternalRefRepository,
  IXeroConnectionRepository,
  IXeroWebhookEventRepository,
} from "@auction/persistence/interfaces";
import type { Env } from "../../env.js";
import type { IDomainEventSink } from "../domain-event-sink.js";
import type { IAccountingQueueService } from "../interfaces/accounting-queue.js";
import type { AdminFinanceRouteServices } from "../interfaces/admin-routes/admin-finance-routes.js";
import type { IPayoutStatementApplicationService } from "../interfaces/finance-routes/finance-payout-statement.js";
import type { IPaymentAdminService } from "../interfaces/payment-service.js";
import type { IPayoutAdminService, IPayoutSettlementService } from "../interfaces/payout.js";
import type { IStripeConnectService } from "../interfaces/stripe-connect.js";
import type { IUnappliedMoneyHandling } from "../payment/unapplied-money-handling.service.js";
import type { XeroOAuthService } from "../xero-oauth.service.js";
import { AdminBlockedPayoutResolutionService } from "./admin-blocked-payout-resolution.service.js";
import { AdminFailedPayoutRetryService } from "./admin-failed-payout-retry.service.js";
import type { AdminPaymentListQueryService } from "./admin-payment-list-query.service.js";
import { AdminPaymentsApplicationService } from "./admin-payments-application.service.js";
import { AdminPayoutApplicationService } from "./admin-payout-application.service.js";
import { AdminStripeConnectApplicationService } from "./admin-stripe-connect-application.service.js";
import { AdminXeroApplicationService } from "./admin-xero-application.service.js";

export type CreateAdminFinanceServicesInput = {
  accountingQueue: IAccountingQueueService;
  paymentService: IPaymentAdminService;
  unappliedMoneyHandling: IUnappliedMoneyHandling;
  adminPaymentListQueryService: AdminPaymentListQueryService;
  stripeConnectService: IStripeConnectService;
  xeroOAuthService: XeroOAuthService | null;
  xeroConnectionRepository: IXeroConnectionRepository;
  xeroWebhookEventRepository: IXeroWebhookEventRepository;
  paymentExternalRefRepository: IPaymentExternalRefRepository;
  userRepository: IUserRepository;
  payoutService: IPayoutAdminService;
  payoutRepository: Pick<IPayoutRepository, "findById" | "findByStripeTransferId">;
  domainEventSink: IDomainEventSink;
  payoutSettlementService: IPayoutSettlementService;
  payoutStatementApplication: IPayoutStatementApplicationService;
  env: Pick<
    Env,
    | "XERO_REDIRECT_URI"
    | "API_PUBLIC_URL"
    | "XERO_WEBHOOK_KEY"
    | "WEB_ORIGIN"
    | "WEB_ORIGINS"
    | "SSR_TRUSTED_ORIGINS"
  >;
};

export type AdminFinanceServicesCore = AdminFinanceRouteServices;

export function createAdminFinanceServices(
  input: CreateAdminFinanceServicesInput,
): AdminFinanceServicesCore {
  return {
    accountingQueue: input.accountingQueue,
    payments: new AdminPaymentsApplicationService(
      input.paymentService,
      input.adminPaymentListQueryService,
      input.unappliedMoneyHandling,
    ),
    payouts: new AdminPayoutApplicationService(
      input.payoutService,
      input.payoutSettlementService,
      input.payoutStatementApplication,
      new AdminFailedPayoutRetryService(
        input.payoutRepository,
        input.stripeConnectService,
        input.domainEventSink,
      ),
      new AdminBlockedPayoutResolutionService(
        input.payoutService,
        input.payoutRepository,
        input.stripeConnectService,
      ),
    ),
    stripeConnect: new AdminStripeConnectApplicationService(
      input.stripeConnectService,
      input.env.WEB_ORIGIN,
    ),
    xero: new AdminXeroApplicationService(
      input.xeroOAuthService,
      input.env.XERO_REDIRECT_URI,
      input.xeroConnectionRepository,
      input.xeroWebhookEventRepository,
      input.paymentExternalRefRepository,
      input.userRepository,
      input.env,
    ),
  };
}
