/** Only the launch host is indexable; staging, preview and platform default domains are not. */
export const ART_PRODUCTION_HOSTS: ReadonlySet<string> = new Set(["www.thelax.art"]);

export const X_ROBOTS_TAG_NOINDEX = "noindex, nofollow, noarchive";

export const NOINDEX_ROBOTS = {
  index: false,
  follow: false,
  googleBot: { index: false, follow: false },
} as const;

export type ArtIndexingOverride = "true" | "false" | undefined;

function normalizeHostname(host: string): string {
  return host.split(":")[0]?.trim().toLowerCase() ?? "";
}

export function isArtIndexingAllowedForHost(host: string, override: ArtIndexingOverride): boolean {
  if (override === "true") return true;
  if (override === "false") return false;
  return ART_PRODUCTION_HOSTS.has(normalizeHostname(host));
}

/** Public host behind Cloudflare / App Platform, where `nextUrl.hostname` is the origin host. */
export function publicRequestHost(headers: { get(name: string): string | null }): string {
  const forwarded = headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;
  return headers.get("host")?.split(",")[0]?.trim() ?? "";
}
