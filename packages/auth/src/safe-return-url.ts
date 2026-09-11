/** Safe relative return paths for issuer-hosted credential flows. */
export function isSafeHostedReturnPath(path: string | null | undefined): boolean {
  if (path == null || path === "") return false;
  if (!path.startsWith("/")) return false;
  if (path.startsWith("//")) return false;
  if (path.includes("\\")) return false;
  const pathOnly = path.split("?")[0] ?? path;
  if (!pathOnly.startsWith("/")) return false;
  if (pathOnly.startsWith("/api")) return false;
  const blockedPrefixes = [
    "/login",
    "/sign-up",
    "/forgot-password",
    "/reset-password",
    "/verify-email",
    "/resend-verification",
    "/two-factor",
    "/auth/",
  ];
  for (const prefix of blockedPrefixes) {
    if (pathOnly === prefix.replace(/\/$/, "") || pathOnly.startsWith(prefix)) return false;
  }
  try {
    const decoded = decodeURIComponent(pathOnly);
    if (decoded.includes("//")) return false;
    if (decoded.includes("\\")) return false;
  } catch {
    return false;
  }
  return true;
}

export function resolveHostedReturnUrl(
  callbackURL: string | null | undefined,
  fallbackPath = "/",
): string {
  if (!callbackURL) return fallbackPath;
  try {
    const parsed = new URL(callbackURL, "https://placeholder.invalid");
    if (parsed.origin !== "https://placeholder.invalid") return fallbackPath;
    if (!isSafeHostedReturnPath(`${parsed.pathname}${parsed.search}`)) return fallbackPath;
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return fallbackPath;
  }
}
