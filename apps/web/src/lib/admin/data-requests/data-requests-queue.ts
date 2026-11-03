import type { DataRequestSummary } from "@auction/identity-contracts/data-requests";
import type { AttentionItem } from "@auction/staff-ui";
import { DATA_REQUESTS_PATH, dataRequestsHref } from "./data-requests-search";

/**
 * The Dashboard's Data requests lines: what is past its legal due date, then what is due within
 * 7 days. Each links to that exact view and drops out at zero.
 */
export function dataRequestsDashboardQueues(summary: DataRequestSummary): AttentionItem[] {
  const items: AttentionItem[] = [];
  if (summary.overdue > 0) {
    items.push({
      id: "data-requests-overdue",
      label: summary.overdue === 1 ? "data request is overdue" : "data requests are overdue",
      count: summary.overdue,
      href: dataRequestsHref({}, { view: "overdue" }),
      tone: "danger",
    });
  }
  if (summary.dueSoon > 0) {
    items.push({
      id: "data-requests-due-soon",
      label:
        summary.dueSoon === 1
          ? "data request is due within 7 days"
          : "data requests are due within 7 days",
      count: summary.dueSoon,
      href: DATA_REQUESTS_PATH,
      tone: "warning",
    });
  }
  return items;
}
