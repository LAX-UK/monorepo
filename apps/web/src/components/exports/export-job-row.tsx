"use client";

import type { ExportJobView } from "@/lib/exports/types";
import { exportPhaseLabel } from "@/lib/ui/export-error-message";
import { Button } from "@auction/ui/components/button";
import { cn } from "@auction/ui/lib/utils";

type Props = {
  job: ExportJobView;
  onCancel?: (id: string) => void;
  onDownload?: (job: ExportJobView) => void;
};

export function ExportJobRow({ job, onCancel, onDownload }: Props) {
  const inProgress = job.status === "pending" || job.status === "processing";
  const failed = job.status === "failed";

  return (
    <div
      className={cn(
        "rounded-lg border border-outline-variant/40 p-3",
        failed && "border-destructive/40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-label text-sm capitalize text-on-surface">
            {job.entityType.replace(/-/g, " ")} · {job.format.toUpperCase()}
          </p>
          {job.filterSummary ? (
            <p className="mt-0.5 truncate font-body text-xs text-on-surface-variant">
              {job.filterSummary}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 gap-1">
          {job.status === "completed" && onDownload ? (
            <Button type="button" size="sm" variant="outline" onClick={() => onDownload(job)}>
              Download
            </Button>
          ) : null}
          {inProgress && onCancel ? (
            <Button type="button" size="sm" variant="ghost" onClick={() => onCancel(job.id)}>
              Cancel
            </Button>
          ) : null}
        </div>
      </div>

      {inProgress ? (
        <div className="mt-2 space-y-1" role="status" aria-live="polite">
          <progress
            className="h-2 w-full overflow-hidden rounded-full accent-lot-orange"
            value={job.progress}
            max={100}
            aria-label="Export progress"
          />
          <p className="font-body text-xs text-on-surface-variant">
            {exportPhaseLabel(job.phase)}
            {job.processedRows != null && job.totalRows != null
              ? ` · ${job.processedRows.toLocaleString()} / ${job.totalRows.toLocaleString()}`
              : null}
          </p>
        </div>
      ) : null}

      {failed && job.errorMessage ? (
        <p className="mt-2 font-body text-xs text-destructive">{job.errorMessage}</p>
      ) : null}
    </div>
  );
}
