import type { SubmissionSlaTone } from "@/lib/admin/submission-sla";
import { cn } from "@auction/ui";

type Props = {
  label: string | null;
  tone: SubmissionSlaTone | null;
};

export function SubmissionSlaCell({ label, tone }: Props) {
  if (!label) {
    return <span className="font-body text-xs text-on-surface-variant">—</span>;
  }

  return (
    <span
      className={cn(
        "inline-flex rounded-md px-2 py-0.5 font-body text-xs font-medium",
        tone === "red" && "bg-error-container/30 text-error",
        tone === "amber" && "bg-warning-container/40 text-on-surface",
        tone === "default" && "text-on-surface-variant",
      )}
    >
      {label}
    </span>
  );
}
