export function isBidSilentSsoEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.SILENT_SSO_ENABLED === "true";
}

export const BID_SILENT_SSO_COOKIE_PREFIX = "bid_sso";

export const BID_SILENT_SSO_SKIP_PREFIXES = [
  "/login",
  "/register",
  "/auth/",
  "/admin",
  "/onboarding",
  "/api/",
];
