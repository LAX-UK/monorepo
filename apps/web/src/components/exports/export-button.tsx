"use client";

import { previewExport } from "@/lib/exports/export-api";
import type { ExportEntityType } from "@auction/exports";
import { Button } from "@auction/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@auction/ui/components/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@auction/ui/components/tooltip";
import { ChevronDown, Download, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { ExportConfirmSheet } from "./export-confirm-sheet";
import { useExportJobs } from "./export-jobs-provider";

type Props = {
  entityType: ExportEntityType;
  filters?: Record<string, unknown>;
  label?: string;
  className?: string;
  variant?: "outline" | "secondary" | "default";
  disabled?: boolean;
  disabledReason?: string;
  forceAsync?: boolean;
};

export function ExportButton({
  entityType,
  filters = {},
  label = "Export",
  className,
  variant = "outline",
  disabled = false,
  disabledReason,
  forceAsync,
}: Props) {
  const { startExport } = useExportJobs();
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [estimatedRows, setEstimatedRows] = useState<number | undefined>();
  const [syncMaxRows, setSyncMaxRows] = useState<number | undefined>();

  useEffect(() => {
    if (!confirmOpen) {
      setEstimatedRows(undefined);
      setSyncMaxRows(undefined);
      return;
    }

    let cancelled = false;
    setPreviewLoading(true);
    void previewExport({ entityType, filters })
      .then((data) => {
        if (cancelled) return;
        setEstimatedRows(data.estimatedRows);
        setSyncMaxRows(data.syncMaxRows);
      })
      .catch(() => {
        if (cancelled) return;
        setEstimatedRows(undefined);
        setSyncMaxRows(undefined);
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [confirmOpen, entityType, filters]);

  const onExportCsv = async () => {
    setLoading(true);
    try {
      await startExport({
        entityType,
        format: "csv",
        filters,
        ...(forceAsync ? { forceAsync: true } : {}),
      });
      setConfirmOpen(false);
    } catch {
      /* toast handled in provider */
    } finally {
      setLoading(false);
    }
  };

  const trigger = (
    <Button
      type="button"
      variant={variant}
      size="sm"
      className={className ?? "min-h-9 gap-1.5 font-label text-xs"}
      disabled={disabled || loading}
      aria-busy={loading}
      aria-haspopup="menu"
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        <Download className="size-4" aria-hidden />
      )}
      {loading ? "Preparing…" : label}
      <ChevronDown className="size-3.5 opacity-70" aria-hidden />
    </Button>
  );

  const runsInBackground =
    forceAsync === true ||
    (estimatedRows != null && syncMaxRows != null && estimatedRows > syncMaxRows);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {disabled && disabledReason ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">{trigger}</span>
                </TooltipTrigger>
                <TooltipContent>{disabledReason}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            trigger
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            disabled={disabled}
            onSelect={(e) => {
              e.preventDefault();
              if (disabled) return;
              setConfirmOpen(true);
            }}
          >
            CSV (.csv)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ExportConfirmSheet
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        entityType={entityType}
        filters={filters}
        {...(estimatedRows !== undefined ? { estimatedRows } : {})}
        {...(syncMaxRows !== undefined ? { syncMaxRows } : {})}
        {...(forceAsync !== undefined
          ? { forceAsync }
          : runsInBackground
            ? { forceAsync: true }
            : {})}
        previewLoading={previewLoading}
        onConfirm={() => void onExportCsv()}
        loading={loading}
      />
    </>
  );
}
