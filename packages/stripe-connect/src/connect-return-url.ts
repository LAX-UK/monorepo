/** Restrict Connect onboarding return/refresh URLs to the trusted web origin. */
export function assertConnectUrlAllowed(
  url: string,
  webOrigin: string | undefined,
  opts?: { failClosed?: boolean },
): void {
  const trustedOrigin = webOrigin?.replace(/\/$/, "");
  if (!trustedOrigin) {
    if (opts?.failClosed) {
      throw new Error("connect_url_origin_not_configured");
    }
    return;
  }

  let parsed: URL;
  let trusted: URL;
  try {
    parsed = new URL(url);
    trusted = new URL(trustedOrigin);
  } catch {
    throw new Error("connect_url_invalid");
  }

  if (parsed.origin !== trusted.origin) {
    throw new Error("connect_url_origin_not_allowed");
  }
}
