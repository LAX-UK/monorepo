import "server-only";

import { LAX_RESOURCE_IDS, REGISTERED_OIDC_CLIENT_IDS } from "@auction/identity-contracts";

export const BID_WEB_CLIENT_ID = REGISTERED_OIDC_CLIENT_IDS.LAX_BID_WEB;
export const BID_API_AUDIENCE = LAX_RESOURCE_IDS.LAX_BID_API;
export const WS_AUDIENCE = LAX_RESOURCE_IDS.LAX_WS;

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for the Bid BFF`);
  return value;
}

export function bffConfig() {
  const publicOrigin = (
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.NODE_ENV === "production" ? "https://lax.bid" : "http://localhost:3000")
  ).replace(/\/+$/, "");
  const issuer = (process.env.OIDC_ISSUER_URL ?? process.env.NEXT_PUBLIC_AUTH_URL)?.replace(
    /\/+$/,
    "",
  );
  if (!issuer) throw new Error("OIDC_ISSUER_URL is required for the Bid BFF");
  return {
    publicOrigin,
    issuer,
    internalIssuer: (process.env.OIDC_INTERNAL_BASE_URL ?? issuer).replace(/\/+$/, ""),
    apiBaseUrl: (
      process.env.INTERNAL_API_URL ??
      process.env.NEXT_PUBLIC_API_URL ??
      "http://127.0.0.1:3001"
    ).replace(/\/+$/, ""),
    clientId: BID_WEB_CLIENT_ID,
    clientSecret: required("OIDC_CLIENT_SECRET_LAX_BID_WEB"),
    redirectUri: `${publicOrigin}/api/auth/callback/lax-bid-web`,
    postLogoutRedirectUri: `${publicOrigin}/`,
    redisUrl: process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
    encryptionKey: required("BID_BFF_SESSION_ENCRYPTION_KEY"),
  };
}
