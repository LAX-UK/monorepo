import type { CatalogDetailSummaryItem } from "@/components/admin/catalog";
import { submissionDetailTabHref } from "@/components/admin/submission-detail/submission-detail-types";
import { adminStatusLabel } from "@/lib/admin/status-badge-variants";
import { formatDateTime } from "@/lib/ui/format";
import type { ItemSubmission } from "@auction/types";

export function buildSubmissionSummaryItems(
  submissionId: string,
  submission: ItemSubmission,
  documentCount: number,
): CatalogDetailSummaryItem[] {
  const submittedDate =
    formatDateTime(submission.createdAt).split(",")[0] ?? formatDateTime(submission.createdAt);

  return [
    {
      id: "status",
      label: "Status",
      value: adminStatusLabel("submission", submission.status),
      hint: submission.reviewedAt ? "Review complete" : "Awaiting staff action",
      href: submissionDetailTabHref(submissionId, "decision"),
    },
    {
      id: "documents",
      label: "Documents",
      value: documentCount,
      hint: documentCount === 0 ? "No uploads" : "View documents",
      href: submissionDetailTabHref(submissionId, "documents"),
    },
    {
      id: "submitted",
      label: "Submitted",
      value: submittedDate,
      hint: formatDateTime(submission.createdAt),
    },
    {
      id: "asking",
      label: "Asking price",
      value: submission.askingPrice ?? "—",
      hint: submission.reservePrice ? `Reserve ${submission.reservePrice}` : "No reserve",
    },
    {
      id: "lot",
      label: "Converted lot",
      value: submission.convertedLotId ? "Linked" : "—",
      hint: submission.convertedLotId ? "Open lot" : "Not converted",
      ...(submission.convertedLotId ? { href: `/admin/lots/${submission.convertedLotId}` } : {}),
    },
  ];
}
