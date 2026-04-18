import type { ItemSubmissionStatus } from "@auction/types";

const styles: Record<ItemSubmissionStatus, string> = {
  draft: "bg-outline-variant/20 text-on-surface-variant",
  submitted: "bg-secondary-container/40 text-on-secondary-container",
  under_review: "bg-tertiary-container/50 text-on-tertiary-container",
  approved: "bg-primary-container/40 text-on-primary-container",
  rejected: "bg-error/15 text-error",
  withdrawn: "bg-outline-variant/15 text-on-surface-variant",
  converted: "bg-primary/15 text-primary",
};

const labels: Record<ItemSubmissionStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under review",
  approved: "Approved",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
  converted: "Converted",
};

export function SubmissionStatusBadge({ status }: { status: ItemSubmissionStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 font-label text-[10px] font-bold uppercase tracking-widest ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}
