"use client";

import { ExportJobRow } from "@/components/exports/export-job-row";
import { useExportJobs } from "@/components/exports/export-jobs-provider";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@auction/ui/components/sheet";
import { useEffect } from "react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ExportManagerSheet({ open, onOpenChange }: Props) {
  const { jobs, cancelJob, downloadJob, ensureJobsLoaded, jobsLoading, jobsLoadError } =
    useExportJobs();

  useEffect(() => {
    if (open) void ensureJobsLoaded();
  }, [ensureJobsLoaded, open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Export history</SheetTitle>
          <SheetDescription>Recent exports from the last 7 days</SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-2 overflow-y-auto">
          {jobsLoading ? (
            <p className="font-body text-sm text-on-surface-variant">Loading export history…</p>
          ) : jobsLoadError ? (
            <p className="font-body text-sm text-warning">{jobsLoadError}</p>
          ) : jobs.length === 0 ? (
            <p className="font-body text-sm text-on-surface-variant">
              No exports yet — use Export on any list page.
            </p>
          ) : (
            jobs.map((job) => (
              <ExportJobRow key={job.id} job={job} onCancel={cancelJob} onDownload={downloadJob} />
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
