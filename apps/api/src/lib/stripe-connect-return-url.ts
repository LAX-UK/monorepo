/** Restrict Connect onboarding return/refresh URLs to the trusted web origin. */
export function assertConnectUrlAllowed(url: string, webOrigin: string | undefined): void {
  const trustedOrigin = webOrigin?.replace(/\/$/, "");
  if (!trustedOrigin) return;

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
