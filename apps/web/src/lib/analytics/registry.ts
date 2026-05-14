import { isAnalyticsEnabled } from "@/lib/analytics/is-enabled";
import type { AnalyticsProvider } from "@/lib/analytics/provider";
import { createGtmAnalyticsProvider } from "@/lib/analytics/providers/gtm";

let cached: AnalyticsProvider[] | null = null;

function buildRegistry(): AnalyticsProvider[] {
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID?.trim();
  if (!isAnalyticsEnabled() || !gtmId) return [];
  return [createGtmAnalyticsProvider(gtmId)];
}

/** Lazy singleton so env is read after Next inlines `NEXT_PUBLIC_*` at build time. */
export function getAnalyticsProviders(): readonly AnalyticsProvider[] {
  if (!cached) {
    cached = buildRegistry();
  }
  return cached;
}

/** Test-only: reset cached registry between Vitest cases. */
export function __resetAnalyticsRegistryForTests(): void {
  cached = null;
}
