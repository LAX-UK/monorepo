"use client";

import { reportWebVitalToSentry } from "@/lib/observability/report-web-vital-to-sentry";
import * as Sentry from "@sentry/nextjs";
import { useReportWebVitals } from "next/web-vitals";

/** Forwards Web Vitals to Sentry metrics when the client SDK is configured. */
export function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    if (!process.env.NEXT_PUBLIC_SENTRY_DSN_WEB) return;
    reportWebVitalToSentry(metric, Sentry.metrics);
  });
  return null;
}
