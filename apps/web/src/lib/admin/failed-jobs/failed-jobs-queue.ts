import type { AttentionItem } from "@auction/staff-ui";

/** The Dashboard's Failed jobs line: failures waiting for review, linking to that view. */
export function failedJobsDashboardQueues(needsReview: number): AttentionItem[] {
  if (needsReview <= 0) return [];
  return [
    {
      id: "failed-jobs-needs-review",
      label: needsReview === 1 ? "failed job needs review" : "failed jobs need review",
      count: needsReview,
      href: "/admin/failed-jobs",
      tone: "warning",
    },
  ];
}
