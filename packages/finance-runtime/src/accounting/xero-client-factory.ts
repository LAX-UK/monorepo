import { XeroClient } from "xero-node";
import type { FinanceRuntimeEnv } from "../env-slice.js";

/** Granular Accounting scopes (required for Xero apps created on/after 2026-03-02). */
const XERO_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "accounting.settings",
  "accounting.contacts",
  "accounting.invoices",
  "accounting.invoices.read",
  "accounting.payments",
];

export type XeroEnvConfig = Pick<
  FinanceRuntimeEnv,
  "XERO_CLIENT_ID" | "XERO_CLIENT_SECRET" | "XERO_REDIRECT_URI"
>;

/** Scopes used for Xero OAuth (exported for OAuth service). */
export function getXeroScopes(): string[] {
  return [...XERO_SCOPES];
}

export function createXeroClientForOAuth(env: XeroEnvConfig, state?: string): XeroClient {
  const cfg: ConstructorParameters<typeof XeroClient>[0] = {
    clientId: env.XERO_CLIENT_ID as string,
    clientSecret: env.XERO_CLIENT_SECRET as string,
    redirectUris: [env.XERO_REDIRECT_URI as string],
    scopes: XERO_SCOPES,
  };
  if (state !== undefined) {
    cfg.state = state;
  }
  return new XeroClient(cfg);
}
