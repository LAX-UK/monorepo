export const ISSUER_CONTINUE_PATHS = [
  "/api/auth/oauth2/authorize",
  "/two-factor",
  "/login",
  "/verify-email",
  "/magic-link",
] as const;

export const RELYING_PARTY_CONTINUE_PATHS = ["/auth/callback"] as const;
export const RELYING_PARTY_CONTINUE_PREFIXES = ["/api/auth/callback/"] as const;

export function isAllowedContinueUrl(
  raw: string,
  origin: string,
  allowedRedirectOrigins: readonly string[],
): boolean {
  try {
    const url = new URL(raw, origin);
    if (url.origin === origin) {
      return (ISSUER_CONTINUE_PATHS as readonly string[]).includes(url.pathname);
    }
    if (!allowedRedirectOrigins.includes(url.origin)) return false;
    if ((RELYING_PARTY_CONTINUE_PATHS as readonly string[]).includes(url.pathname)) return true;
    return RELYING_PARTY_CONTINUE_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));
  } catch {
    return false;
  }
}

export function productHintLoginUrl(origin: string, loginPath: string): string {
  const login = new URL(loginPath, origin);
  const next = new URL("/login", origin);
  const clientId = login.searchParams.get("client_id");
  if (clientId) next.searchParams.set("client_id", clientId);
  return next.toString();
}

export type ContinuePayload = {
  twoFactorRedirect?: unknown;
  url?: unknown;
  redirectURI?: unknown;
} | null;

export type ContinueConfig = {
  twoFactorPath?: string;
  authorizeResumePath?: string | null;
  restartUrl?: string;
  loginPath?: string;
  allowedRedirectOrigins?: readonly string[];
};

export function resolveContinueUrl(
  payload: ContinuePayload,
  origin: string,
  config: ContinueConfig,
): string {
  if (payload?.twoFactorRedirect) {
    return new URL(config.twoFactorPath || "/two-factor", origin).toString();
  }
  const candidate =
    typeof payload?.url === "string"
      ? payload.url
      : typeof payload?.redirectURI === "string"
        ? payload.redirectURI
        : null;
  const allowed = config.allowedRedirectOrigins ?? [];
  if (candidate && isAllowedContinueUrl(candidate, origin, allowed)) {
    return new URL(candidate, origin).toString();
  }
  if (
    config.authorizeResumePath &&
    isAllowedContinueUrl(config.authorizeResumePath, origin, allowed)
  ) {
    return new URL(config.authorizeResumePath, origin).toString();
  }
  if (config.restartUrl) return config.restartUrl;
  return productHintLoginUrl(origin, config.loginPath || "/login");
}
