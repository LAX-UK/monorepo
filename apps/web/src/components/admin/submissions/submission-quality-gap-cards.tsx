import type { SubmissionQualityGapItem } from "@/lib/admin/submissions/submission-quality-presentation";
import { AlertTriangle } from "lucide-react";

type Props = {
  gaps: SubmissionQualityGapItem[];
};

export function SubmissionQualityGapCards({ gaps }: Props) {
  if (gaps.length === 0) return null;

  return (
    <section className="space-y-3 border-b border-border-hairline pb-6">
      <p className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
        Quality gaps ({gaps.length})
      </p>
      <div className="space-y-3">
        {gaps.map((gap) => (
          <div
            key={gap.id}
            className="flex gap-3 rounded border border-warning-container bg-warning-container/30 p-4 pl-4"
          >
            <AlertTriangle className="mt-0.5 size-[18px] shrink-0 text-warning" aria-hidden />
            <div className="min-w-0 space-y-1">
              <p className="font-body text-sm font-medium text-on-surface">{gap.label}</p>
              <p className="font-body text-sm text-on-surface-variant">{gap.description}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
