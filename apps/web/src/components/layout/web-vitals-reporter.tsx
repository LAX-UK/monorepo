"use client";

import { useReportWebVitals } from "next/web-vitals";

type SentryWindow = Window & {
  Sentry?: {
    captureMessage?: (message: string, options?: Record<string, unknown>) => void;
  };
};

/**
 * Lightweight Web Vitals reporter. Forwards each metric to Sentry's global
 * shim when available (`window.Sentry.captureMessage`). When Sentry is not
 * loaded — or when `NEXT_PUBLIC_SENTRY_DSN_WEB` is not configured — the
 * component is a no-op.
 *
 * The component renders nothing; it only mounts the reporter hook.
 */
export function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    if (typeof window === "undefined") return;
    if (!process.env.NEXT_PUBLIC_SENTRY_DSN_WEB) return;
    const sentry = (window as SentryWindow).Sentry;
    if (!sentry?.captureMessage) return;
    sentry.captureMessage(`web-vitals.${metric.name}`, {
      level: "info",
      tags: { metric: metric.name, id: metric.id },
      extra: {
        value: metric.value,
        rating: metric.rating,
        delta: metric.delta,
        navigationType: metric.navigationType,
      },
    });
  });
  return null;
}
