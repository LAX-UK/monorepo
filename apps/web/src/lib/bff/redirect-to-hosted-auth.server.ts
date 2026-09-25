import "server-only";

import { REGISTERED_OIDC_CLIENT_IDS } from "@auction/identity-contracts";
import type { HostedAuthEntry } from "./auth-entry-intent.server";
import { bffConfig } from "./config.server";

export type { HostedAuthEntry };

export function buildBidIssuerHostedUrl(
  path:
    | "/forgot-password"
    | "/reset-password"
    | "/two-factor"
    | "/resend-verification"
    | "/verify-email"
    | "/login"
    | "/sign-up"
    | "/magic-link",
  query?: Record<string, string | undefined>,
): string {
  const { issuer } = bffConfig();
  const url = new URL(path, issuer);
  url.searchParams.set("client_id", REGISTERED_OIDC_CLIENT_IDS.LAX_BID_WEB);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value) url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

export function buildBidHostedRecoveryUrl(
  path: "/forgot-password" | "/reset-password",
  token?: string,
): string {
  return buildBidIssuerHostedUrl(path, token ? { token } : undefined);
}

function hostedEntryIntentParam(entry: HostedAuthEntry): string | null {
  if (entry.reauth) return "reauth";
  if (entry.funnel === "sell") return "sell";
  if (entry.screen === "signup") return "signup";
  return null;
}

export function buildBidOidcLoginStartUrl(entry: HostedAuthEntry): string {
  const params = new URLSearchParams();
  params.set("next", entry.nextPath);
  const intent = hostedEntryIntentParam(entry);
  if (intent) params.set("intent", intent);
  if (entry.inviteToken) params.set("invite", entry.inviteToken);
  if (entry.forceLoginPrompt && !entry.reauth) params.set("switch", "1");
  return `/api/auth/login?${params.toString()}`;
}
