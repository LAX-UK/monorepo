/** Shared env slice for worker-local Xero/Stripe finance execution (not API HTTP rollback). */
export type FinanceRuntimeEnv = {
  NODE_ENV: "development" | "production" | "test";
  XERO_CLIENT_ID?: string | undefined;
  XERO_CLIENT_SECRET?: string | undefined;
  XERO_REDIRECT_URI?: string | undefined;
  XERO_DEFAULT_REVENUE_ACCOUNT_CODE: string;
  XERO_DEFAULT_TAX_TYPE: string;
  XERO_INVOICE_DUE_DAYS: number;
  XERO_USE_LEGAL_ENTITY_CONTACT: boolean;
  XERO_PAYOUT_BILL_ACCOUNT_CODE: string;
  XERO_PAYMENT_BANK_ACCOUNT_CODE: string;
  /** When true, blocks Xero mutations in this process (API cutover). Worker should leave false. */
  XERO_API_WRITES_DISABLED: boolean;
  STRIPE_SECRET_KEY?: string | undefined;
  DISABLE_PAYOUT_SETTLEMENT: boolean;
  LOG_LEVEL?: string;
};

export function xeroOAuthConfigured(env: FinanceRuntimeEnv): boolean {
  return Boolean(env.XERO_CLIENT_ID && env.XERO_CLIENT_SECRET && env.XERO_REDIRECT_URI);
}
