/** Public site origin for canonical URLs, sitemap, OG metadata, and KYC return URLs. */
export function getSiteUrl(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  const fromEnv =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    process.env.NEXT_PUBLIC_WEB_ORIGIN?.replace(/\/$/, "");

  return fromEnv ?? "http://localhost:3000";
}
