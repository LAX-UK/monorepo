/** Where test environments serve product media from, used when nothing is configured. */
export const DEFAULT_MEDIA_ORIGINS: readonly string[] = [
  "https://lax-media.lon1.cdn.digitaloceanspaces.com",
];

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

function originOf(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    if (url.username || url.password) return null;
    const isLocal = LOCAL_HOSTS.has(url.hostname);
    if (url.protocol === "https:" || (url.protocol === "http:" && isLocal)) return url.origin;
    return null;
  } catch {
    return null;
  }
}

/**
 * The origins product images may load from: `LAX_MEDIA_ORIGINS` (comma-separated), plus the
 * media bases Bid and Shop already publish. Invalid or non-https entries are ignored. With
 * nothing configured the shared test media host is allowed.
 */
export function parseMediaOrigins(
  source: Record<string, string | undefined> = process.env,
): string[] {
  const candidates = [
    ...(source.LAX_MEDIA_ORIGINS?.split(",") ?? []),
    source.NEXT_PUBLIC_MEDIA_BASE_URL ?? "",
    source.SHOP_MEDIA_PUBLIC_BASE_URL ?? "",
  ];
  const origins = [...new Set(candidates.flatMap((candidate) => originOf(candidate) ?? []))];
  return origins.length > 0 ? origins : [...DEFAULT_MEDIA_ORIGINS];
}

/** An image URL is kept only when it is on an allowed media origin; anything else is dropped. */
export function safeImageUrl(
  src: string | null | undefined,
  allowedOrigins: readonly string[],
): string | null {
  if (!src) return null;
  const origin = originOf(src);
  return origin && allowedOrigins.includes(origin) ? src : null;
}
