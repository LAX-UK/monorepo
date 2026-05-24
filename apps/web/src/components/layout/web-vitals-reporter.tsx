"use client";

import * as Sentry from "@sentry/nextjs";
import { useReportWebVitals } from "next/web-vitals";

/** Forwards Web Vitals metrics to Sentry when the client SDK is configured. */
export function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    if (!process.env.NEXT_PUBLIC_SENTRY_DSN_WEB) return;
    Sentry.captureMessage(`web-vitals.${metric.name}`, {
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
