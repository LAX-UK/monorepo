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

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ExportManagerSheet({ open, onOpenChange }: Props) {
  const { jobs, cancelJob, downloadJob, refreshJobs } = useExportJobs();

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (next) void refreshJobs();
      }}
    >
      <SheetContent side="right" className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Export history</SheetTitle>
          <SheetDescription>Recent exports from the last 7 days</SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-2 overflow-y-auto">
          {jobs.length === 0 ? (
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
