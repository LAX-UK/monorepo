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
    const decoded = decodeURIComponent(pathOnly);
    if (decoded.includes("//")) return false;
    if (decoded.includes("\\")) return false;
  } catch {
    return false;
  }
  return true;
}
