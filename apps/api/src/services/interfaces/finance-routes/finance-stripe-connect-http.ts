import type { FinanceHttpJson } from "./finance-route-http.js";

export type StripeConnectLegalEntityRole = "owner" | "admin" | "finance" | string;

export type StripeConnectLegalEntityContext = {
  legalEntityId: string;
  role: StripeConnectLegalEntityRole;
};

export interface IStripeConnectHttpApplicationService {
  getClientConfig(): Promise<FinanceHttpJson>;

  getStatus(ctx: StripeConnectLegalEntityContext): Promise<FinanceHttpJson>;

  syncAccountFromStripe(ctx: StripeConnectLegalEntityContext): Promise<FinanceHttpJson>;

  createAccountSession(
    ctx: StripeConnectLegalEntityContext,
    surface: "onboarding" | "management",
  ): Promise<FinanceHttpJson>;

  ensureAccount(ctx: StripeConnectLegalEntityContext): Promise<FinanceHttpJson>;

  createOnboardingLink(
    ctx: StripeConnectLegalEntityContext,
    returnUrl: string,
    refreshUrl: string,
  ): Promise<FinanceHttpJson>;

  createDashboardLink(ctx: StripeConnectLegalEntityContext): Promise<FinanceHttpJson>;
}
