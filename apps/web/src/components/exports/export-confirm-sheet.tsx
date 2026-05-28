"use client";

import type { ExportEntityType } from "@auction/exports";
import { Button } from "@auction/ui/components/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@auction/ui/components/sheet";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: ExportEntityType;
  filters: Record<string, unknown>;
  estimatedRows?: number;
  syncMaxRows?: number;
  forceAsync?: boolean;
  previewLoading?: boolean;
  onConfirm: () => void;
  loading?: boolean;
};

function filterSummary(filters: Record<string, unknown>): string {
  const parts = Object.entries(filters)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k}: ${String(v)}`);
  return parts.length > 0 ? parts.join(" · ") : "All records";
}

export function ExportConfirmSheet({
  open,
  onOpenChange,
  entityType,
  filters,
  estimatedRows,
  syncMaxRows,
  forceAsync,
  previewLoading,
  onConfirm,
  loading,
}: Props) {
  const asyncThreshold = syncMaxRows ?? 5000;
  const runsInBackground =
    forceAsync === true || (estimatedRows != null && estimatedRows > asyncThreshold);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Export {entityType}</SheetTitle>
          <SheetDescription>
            {previewLoading
              ? "Estimating row count…"
              : estimatedRows != null
                ? `~${estimatedRows.toLocaleString()} rows · CSV`
                : "CSV export"}
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-3 px-4 py-2 font-body text-sm text-on-surface-variant">
          <p>Filters: {filterSummary(filters)}</p>
          {runsInBackground ? (
            <>
              <p>
                This export runs in the background. You can keep working — we will notify you when
                it is ready.
              </p>
              {estimatedRows != null && estimatedRows > asyncThreshold ? (
                <p>Estimated time: 1–3 minutes</p>
              ) : null}
            </>
          ) : (
            <p>
              Small exports download immediately. If the dataset is large, it will run in the
              background instead.
            </p>
          )}
        </div>
        <SheetFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button type="button" onClick={onConfirm} disabled={loading || previewLoading}>
            {loading ? "Starting…" : runsInBackground ? "Start export" : "Download CSV"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
