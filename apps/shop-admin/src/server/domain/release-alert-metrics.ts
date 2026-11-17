import type { AdminReleaseAlertSummary } from "@auction/shop-contracts";
import { RELEASE_ALERT_SENDS_COPY } from "./release-alert-sends.copy";

const count = new Intl.NumberFormat("en-GB");

/** The release alert list as two figures above the leads: who is emailed, and who has yet to confirm. */
export function releaseAlertMetrics(summary: AdminReleaseAlertSummary) {
  return [
    {
      id: "release-alert-subscribers",
      label: "Release alert subscribers",
      value: count.format(summary.confirmed),
      emptyText: "Nobody has confirmed yet",
    },
    {
      id: "release-alert-waiting",
      label: "Awaiting confirmation",
      value: count.format(summary.awaitingConfirmation),
    },
  ];
}

/**
 * The figures as the Leads page's metric strip, above the leads list and the release-alert send
 * log alike; nothing when they could not be read, so a missing figure never blocks the list.
 */
export function releaseAlertMetricStrip(summary: AdminReleaseAlertSummary | null) {
  if (!summary) return {};
  return {
    metrics: {
      label: RELEASE_ALERT_SENDS_COPY.metricsLabel,
      period: RELEASE_ALERT_SENDS_COPY.metricsPeriod,
      items: releaseAlertMetrics(summary),
    },
  };
}
