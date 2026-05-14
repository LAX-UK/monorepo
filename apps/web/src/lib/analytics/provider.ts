import type { ConsentSnapshot } from "@/lib/analytics/consent/cookie";

export type TrackPayload = {
  name: string;
  params?: Record<string, unknown>;
};

/** Pluggable vendor (GTM today; Meta Pixel tomorrow) — same contract for all. */
export type AnalyticsProvider = {
  readonly id: string;
  /** One-time: push Consent Mode defaults before any tag loads. */
  pushConsentDefault(): void;
  /** After user choice or SSR-hydrated cookie. */
  updateConsent(snapshot: ConsentSnapshot | null): void;
  track(payload: TrackPayload): void;
};
