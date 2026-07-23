import type { IUserRepository } from "@auction/persistence/interfaces";
import type {
  IPaymentExternalRefRepository,
  IXeroConnectionRepository,
  IXeroWebhookEventRepository,
} from "@auction/persistence/interfaces";
import type { Env } from "../../env.js";
import type { AdminFinanceRouteServices } from "../interfaces/admin-routes/admin-finance-routes.js";
import type { IPayoutStatementApplicationService } from "../interfaces/finance-routes/finance-payout-statement.js";
import type { IPaymentAdminService } from "../interfaces/payment-service.js";
import type { IPayoutAdminService, IPayoutSettlementService } from "../interfaces/payout.js";
import type { IStripeConnectService } from "../interfaces/stripe-connect.js";
import type { XeroOAuthService } from "../xero-oauth.service.js";
import type { AdminPaymentListQueryService } from "./admin-payment-list-query.service.js";
import { AdminPaymentsApplicationService } from "./admin-payments-application.service.js";
import { AdminPayoutApplicationService } from "./admin-payout-application.service.js";
import { AdminStripeConnectApplicationService } from "./admin-stripe-connect-application.service.js";
import { AdminXeroApplicationService } from "./admin-xero-application.service.js";

export type CreateAdminFinanceServicesInput = {
  paymentService: IPaymentAdminService;
  adminPaymentListQueryService: AdminPaymentListQueryService;
  stripeConnectService: IStripeConnectService;
  xeroOAuthService: XeroOAuthService | null;
  xeroConnectionRepository: IXeroConnectionRepository;
  xeroWebhookEventRepository: IXeroWebhookEventRepository;
  paymentExternalRefRepository: IPaymentExternalRefRepository;
  userRepository: IUserRepository;
  payoutService: IPayoutAdminService;
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
    payments: new AdminPaymentsApplicationService(
      input.paymentService,
      input.adminPaymentListQueryService,
    ),
    payouts: new AdminPayoutApplicationService(
      input.payoutService,
      input.payoutSettlementService,
      input.payoutStatementApplication,
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
