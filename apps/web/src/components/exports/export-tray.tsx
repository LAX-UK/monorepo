"use client";

import { ExportJobRow } from "@/components/exports/export-job-row";
import { useExportJobs } from "@/components/exports/export-jobs-provider";
import { ExportManagerSheet } from "@/components/exports/export-manager-sheet";
import { Button } from "@auction/ui/components/button";
import { cn } from "@auction/ui/lib/utils";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { useState } from "react";

export function ExportTray() {
  const { jobs, trayOpen, setTrayOpen, activeCount, cancelJob, downloadJob } = useExportJobs();
  const [managerOpen, setManagerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const visible = jobs.slice(0, 5);
  if (visible.length === 0 && activeCount === 0) return null;

  if (!trayOpen && activeCount > 0) {
    return (
      <Button
        type="button"
        variant="outline"
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full border border-outline-variant/50 bg-surface px-4 py-2 font-label text-xs shadow-lg"
        onClick={() => setTrayOpen(true)}
      >
        {activeCount} export{activeCount === 1 ? "" : "s"} running
      </Button>
    );
  }

  if (!trayOpen) return null;

  return (
    <>
      <div
        className={cn(
          "fixed bottom-4 right-4 z-50 w-[min(100vw-2rem,320px)] rounded-xl border border-outline-variant/50 bg-surface shadow-xl",
          collapsed && "w-auto",
        )}
        aria-live="polite"
      >
        <div className="flex items-center justify-between gap-2 border-b border-outline-variant/30 px-3 py-2">
          <p className="font-label text-sm">Exports</p>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label={collapsed ? "Expand exports panel" : "Collapse exports panel"}
              onClick={() => setCollapsed((c) => !c)}
            >
              {collapsed ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label="Close exports panel"
              onClick={() => setTrayOpen(false)}
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>
        {!collapsed ? (
          <div className="max-h-80 space-y-2 overflow-y-auto p-3">
            {visible.map((job) => (
              <ExportJobRow key={job.id} job={job} onCancel={cancelJob} onDownload={downloadJob} />
            ))}
            <Button
              type="button"
              variant="link"
              className="h-auto p-0 font-label text-xs"
              onClick={() => setManagerOpen(true)}
            >
              View all exports
            </Button>
          </div>
        ) : null}
      </div>
      <ExportManagerSheet open={managerOpen} onOpenChange={setManagerOpen} />
    </>
  );
}
