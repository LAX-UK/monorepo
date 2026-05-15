import {
  submissionStatusLabel,
  submissionStatusToBadgeVariant,
} from "@/lib/admin/status-badge-variants";
import type { ItemSubmissionStatus } from "@auction/types";

const variantClasses: Record<ReturnType<typeof submissionStatusToBadgeVariant>, string> = {
  neutral: "bg-outline-variant/20 text-on-surface-variant",
  info: "bg-secondary-container/40 text-on-secondary-container",
  warning: "bg-tertiary-container/50 text-on-tertiary-container",
  success: "bg-primary-container/40 text-on-primary-container",
  danger: "bg-error/15 text-error",
  live: "bg-primary/15 text-primary",
};

export function SubmissionStatusBadge({ status }: { status: ItemSubmissionStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 font-label text-[10px] font-bold uppercase tracking-widest ${variantClasses[submissionStatusToBadgeVariant(status)]}`}
    >
      {submissionStatusLabel[status]}
    </span>
  );
}
