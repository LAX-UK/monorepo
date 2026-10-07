const DEFAULT_RETURN_TO = "/overview";

/**
 * Same-origin relative path only. Rejects open redirects (absolute URLs, protocol-relative).
 */
export function safeReturnTo(raw: string | null | undefined, fallback = DEFAULT_RETURN_TO): string {
  const value = raw?.trim();
  if (!value) return fallback;
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//")) return fallback;
  if (value.includes("\\")) return fallback;
  try {
    const parsed = new URL(value, "https://placeholder.invalid");
    if (parsed.hostname !== "placeholder.invalid") return fallback;
  } catch {
    return fallback;
  }
  return value;
}
