export function resolveMagicLinkUrl(input: {
  pluginUrl?: string | undefined;
  issuerBase: string;
  webBase: string;
  token: string;
}): string {
  if (input.pluginUrl) {
    try {
      const parsed = new URL(input.pluginUrl);
      const issuer = new URL(input.issuerBase);
      if (parsed.origin === issuer.origin && isIssuerContinuation(parsed, issuer)) {
        return parsed.toString();
      }
    } catch {
      // fall through to Bid activation URL
    }
  }
  return `${input.webBase.replace(/\/$/, "")}/auth/activate?token=${encodeURIComponent(input.token)}`;
}

function isIssuerContinuation(pluginUrl: URL, issuer: URL): boolean {
  const callback = pluginUrl.searchParams.get("callbackURL") ?? "";
  if (!callback) {
    return pluginUrl.pathname.includes("/magic-link/verify");
  }
  try {
    const url = new URL(callback, issuer);
    if (url.origin !== issuer.origin) return false;
    return (
      url.pathname === "/login" ||
      url.pathname === "/api/auth/oauth2/authorize" ||
      url.pathname === "/magic-link" ||
      url.pathname === "/two-factor"
    );
  } catch {
    return false;
  }
}
