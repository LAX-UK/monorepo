import type { AdminReleaseAlertSummary } from "@auction/shop-contracts";

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
