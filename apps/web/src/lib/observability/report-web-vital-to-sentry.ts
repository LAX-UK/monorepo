export type WebVitalMetric = {
  name: string;
  value: number;
  rating: string;
  navigationType: string;
};

type SentryMetrics = {
  distribution?: (
    name: string,
    value: number,
    options?: { unit?: string; attributes?: Record<string, string> },
  ) => void;
};

/** Report a Web Vital to Sentry metrics when available; never opens an Issue. */
export function reportWebVitalToSentry(
  metric: WebVitalMetric,
  sentryMetrics: SentryMetrics | undefined,
  pathname?: string,
): void {
  if (!sentryMetrics?.distribution) return;
  const unit = metric.name === "CLS" ? undefined : "millisecond";
  sentryMetrics.distribution(`web_vitals.${metric.name}`, metric.value, {
    ...(unit !== undefined ? { unit } : {}),
    attributes: {
      rating: metric.rating,
      navigationType: metric.navigationType,
      ...(pathname ? { pathname } : {}),
    },
  });
}
