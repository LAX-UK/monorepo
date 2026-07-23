import type { Container } from "../../../container.js";
import type { FinanceRouteServices } from "./index.js";

type FinanceRoutePick<K extends keyof FinanceRouteServices> = {
  finance: Pick<FinanceRouteServices, K>;
};

export type FinanceBuyerPaymentHttpRoutesContainer = FinanceRoutePick<
  "buyerPaymentHttp" | "entityStaffPayment"
> &
  Pick<
    Container,
    | "userSuspensionChecker"
    | "impersonationAuditService"
    | "impersonationSessionService"
    | "legalEntityRepository"
  >;

export type FinanceEntityStaffPaymentRoutesContainer = FinanceRoutePick<"entityStaffPayment"> &
  Pick<
    Container,
    | "userSuspensionChecker"
    | "impersonationAuditService"
    | "impersonationSessionService"
    | "legalEntityRepository"
  >;

export type FinancePayoutStatementRoutesContainer = FinanceRoutePick<"payoutStatement"> &
  Pick<Container, "userSuspensionChecker">;

export type FinanceInternalCronRoutesContainer = FinanceRoutePick<
  "internalCron" | "accountingCron" | "settlementCron"
>;

export type FinanceStripeWebhookRoutesContainer = FinanceRoutePick<"stripeWebhooks">;

export type FinanceSellerPayoutRoutesContainer = FinanceRoutePick<"sellerPayoutHttp"> &
  Pick<Container, "userSuspensionChecker" | "requireLegalEntityContext">;

export type FinanceStripeConnectRoutesContainer = FinanceRoutePick<"stripeConnectHttp"> &
  Pick<Container, "userSuspensionChecker" | "requireLegalEntityContext">;

export type FinanceXeroWebhookRoutesContainer = FinanceRoutePick<"xeroWebhooks">;
