/** Same-origin relative paths only. Blocks open redirects (`//evil`, `https:`, `\`, `/api`, etc.).
 * Rejects URL-encoded variants (e.g. `/%2F%2Fevil.com` → `///evil.com`).
 */
export function isSafeNextPath(next: string | null | undefined): boolean {
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
    let decoded = pathOnly;
    while (true) {
      const nextDecoded = decodeURIComponent(decoded);
      if (nextDecoded.includes("//") || nextDecoded.includes("\\")) return false;
      if (nextDecoded === decoded) break;
      decoded = nextDecoded;
    }
  } catch {
    return false;
  }
  return true;
}
