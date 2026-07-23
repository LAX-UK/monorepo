/**
 * UTM attribution capture is gated separately from GTM load so it can ship dark.
 */
export function isMarketingAttributionEnabled(): boolean {
  if (process.env.NODE_ENV !== "production") return false;
  const raw = process.env.NEXT_PUBLIC_MARKETING_ATTRIBUTION_ENABLED?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}
