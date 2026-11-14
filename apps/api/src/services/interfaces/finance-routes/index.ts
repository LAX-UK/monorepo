export type {
  PayoutStatementOutcome,
  IPayoutStatementApplicationService,
} from "./finance-payout-statement.js";
export type {
  BuyerCheckoutHttpData,
  BuyerCheckoutHttpResult,
  BuyerComplianceGateData,
  BuyerSofAttachResult,
  BuyerSofSubmitResult,
  IBuyerPaymentHttpApplicationService,
} from "./finance-buyer-payment-http.js";
export type {
  FinanceHttpJson,
  FinanceRouteErr,
  FinanceRouteOk,
  FinanceRouteOutcome,
  FinanceRouteServiceError,
} from "./finance-route-http.js";
export type { IEntityStaffPaymentApplicationService } from "./finance-entity-staff-payment.js";
export type {
  BulkPayoutSettlementCronResult,
  IInternalCronApplicationService,
} from "./finance-internal-cron.js";
export type { IFinanceAccountingCronApplicationService } from "./finance-accounting-cron.js";
export type { IFinanceSettlementCronApplicationService } from "./finance-settlement-cron.js";
export type {
  StripeWebhookIngressResult,
  IStripeWebhookIngressApplicationService,
} from "./finance-stripe-webhook-ingress.js";
export type { ISellerPayoutHttpApplicationService } from "./finance-seller-payout-http.js";
export type {
  IStripeConnectHttpApplicationService,
  StripeConnectLegalEntityContext,
} from "./finance-stripe-connect-http.js";
export type { IXeroWebhookIngressApplicationService } from "./finance-xero-webhook-ingress.js";
export type {
  IZohoBooksNoticeIngressApplicationService,
  ZohoBooksNoticeRequest,
} from "./finance-zoho-books-notice-ingress.js";

import type { IPrivateSaleDealParties } from "../private-sale-deal-desk.js";
import type { IFinanceAccountingCronApplicationService } from "./finance-accounting-cron.js";
import type { IBuyerPaymentHttpApplicationService } from "./finance-buyer-payment-http.js";
import type { IEntityStaffPaymentApplicationService } from "./finance-entity-staff-payment.js";
import type { IInternalCronApplicationService } from "./finance-internal-cron.js";
import type { IPayoutStatementApplicationService } from "./finance-payout-statement.js";
import type { ISellerPayoutHttpApplicationService } from "./finance-seller-payout-http.js";
import type { IFinanceSettlementCronApplicationService } from "./finance-settlement-cron.js";
import type { IStripeConnectHttpApplicationService } from "./finance-stripe-connect-http.js";
import type { IStripeWebhookIngressApplicationService } from "./finance-stripe-webhook-ingress.js";
import type { IXeroWebhookIngressApplicationService } from "./finance-xero-webhook-ingress.js";
import type { IZohoBooksNoticeIngressApplicationService } from "./finance-zoho-books-notice-ingress.js";

export type FinanceRouteServices = {
  /** A buyer's and a seller's own private sale deals. */
  privateSaleDealParties: IPrivateSaleDealParties;
  payoutStatement: IPayoutStatementApplicationService;
  sellerPayoutHttp: ISellerPayoutHttpApplicationService;
  stripeConnectHttp: IStripeConnectHttpApplicationService;
  buyerPaymentHttp: IBuyerPaymentHttpApplicationService;
  entityStaffPayment: IEntityStaffPaymentApplicationService;
  internalCron: IInternalCronApplicationService;
  accountingCron: IFinanceAccountingCronApplicationService;
  settlementCron: IFinanceSettlementCronApplicationService;
  stripeWebhooks: IStripeWebhookIngressApplicationService;
  xeroWebhooks: IXeroWebhookIngressApplicationService;
  /** Signed Zoho Books workflow notices: stored as hints to read a document from Books again. */
  zohoBooksNotices: IZohoBooksNoticeIngressApplicationService;
};

export type {
  FinanceBuyerPaymentHttpRoutesContainer,
  FinanceEntityStaffPaymentRoutesContainer,
  FinanceInternalCronRoutesContainer,
  FinancePayoutStatementRoutesContainer,
  FinanceSellerPayoutRoutesContainer,
  FinanceStripeConnectRoutesContainer,
  FinanceStripeWebhookRoutesContainer,
  FinanceXeroWebhookRoutesContainer,
} from "./finance-route-container-slices.js";
