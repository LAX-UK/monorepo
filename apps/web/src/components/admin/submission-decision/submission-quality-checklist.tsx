import { evaluateSubmissionQuality } from "@auction/domain";
import type { ItemSubmission } from "@auction/types";
import { CheckCircle2, CircleAlert } from "lucide-react";

type Props = {
  submission: Pick<
    ItemSubmission,
    "title" | "images" | "description" | "provenance" | "categoryId" | "categoryIds"
  >;
};

export function SubmissionQualityChecklist({ submission }: Props) {
  const { checks } = evaluateSubmissionQuality(submission);
  return (
    <ul className="space-y-2 rounded-md border border-outline-variant/30 bg-surface-container-lowest/60 p-3">
      {checks.map((check) => (
        <li key={check.id} className="flex items-start gap-2 font-body text-xs">
          {check.ok ? (
            <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
          ) : (
            <CircleAlert
              className={`mt-0.5 size-3.5 shrink-0 ${check.severity === "required" ? "text-error" : "text-on-surface-variant"}`}
              aria-hidden
            />
          )}
          <span className={check.ok ? "text-on-surface-variant" : "text-on-surface"}>
            {check.label}
            {check.severity === "warning" && !check.ok ? " (recommended)" : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}
