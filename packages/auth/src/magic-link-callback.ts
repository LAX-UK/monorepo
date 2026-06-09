/** Safe relative `next` paths for magic-link post-verify redirects (mirrors web post-auth policy). */
export function isSafeMagicLinkNextPath(next: string | null | undefined): boolean {
  if (next == null || next === "") return false;
  if (!next.startsWith("/")) return false;
  if (next.startsWith("//")) return false;
  if (next.includes("\\")) return false;
  const pathOnly = next.split("?")[0] ?? next;
  if (!pathOnly.startsWith("/")) return false;
  if (pathOnly.startsWith("/api")) return false;
  if (pathOnly.startsWith("/admin/api")) return false;
  const blockedPrefixes = [
    "/login",
    "/register",
    "/account-suspended",
    "/forgot-password",
    "/reset-password",
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

export function buildMagicLinkSetPasswordCallbackUrl(
  webOrigin: string,
  next?: string | null,
): string {
  const base = `${webOrigin.replace(/\/$/, "")}/auth/activate/set-password`;
  if (next && isSafeMagicLinkNextPath(next)) {
    return `${base}?next=${encodeURIComponent(next)}`;
  }
  return base;
}

export function buildMagicLinkExpiredCallbackUrl(webOrigin: string): string {
  return `${webOrigin.replace(/\/$/, "")}/auth/activate/expired`;
}
