const PLACEHOLDER_ORIGIN = "https://rp-return.invalid";

/**
 * Same-origin relative path for post-auth redirects, or null.
 * Browsers treat `\` as `/`, so `/\evil.example` is protocol-relative.
 */
export function safeRelativeReturnPath(raw: string | null | undefined): string | null {
  const value = raw?.trim();
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  if (value.includes("\\")) return null;
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return null;
  }
  try {
    if (new URL(value, PLACEHOLDER_ORIGIN).origin !== PLACEHOLDER_ORIGIN) return null;
  } catch {
    return null;
  }
  return value;
}
