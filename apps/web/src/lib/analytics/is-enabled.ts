/**
 * Analytics (GTM / tags) may only run in production builds with an explicit container id.
 * Local dev, tests, and CI omit `NEXT_PUBLIC_GTM_ID` so this stays false.
 */
export function isAnalyticsEnabled(): boolean {
  if (process.env.NODE_ENV !== "production") return false;
  const id = process.env.NEXT_PUBLIC_GTM_ID?.trim();
  return Boolean(id);
}
