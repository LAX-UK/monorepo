"use client";

import { ChevronDown, Download } from "lucide-react";
import { type StaffPermission, useStaffCan } from "../access/staff-access.js";
import { StaffButton } from "../primitives/button.js";
import {
  StaffMenu,
  StaffMenuContent,
  StaffMenuItem,
  StaffMenuTrigger,
} from "../primitives/menu.js";

export type CsvExportScope = "shown" | "all";

/**
 * Export as CSV, following the search and filters in force: "the 3 shown" first, then "all 12"
 * when they differ. Offered only when there is something to export, and only to people who may
 * export (`requires`).
 */
export function CsvExportMenu({
  noun,
  shown,
  total,
  onExport,
  requires,
}: {
  /** What a row is, in the plural: "documents", "staff members". */
  noun: string;
  /** Rows the current search and filters show. */
  shown: number;
  total: number;
  onExport: (scope: CsvExportScope) => void;
  requires?: StaffPermission;
}) {
  const permitted = useStaffCan(requires);
  if (total === 0 || !permitted) return null;
  const filtered = shown !== total;
  return (
    <StaffMenu>
      <StaffMenuTrigger asChild>
        <StaffButton size="sm" variant="secondary" icon={<Download aria-hidden />}>
          Export
          <ChevronDown aria-hidden className="size-3.5" />
        </StaffButton>
      </StaffMenuTrigger>
      <StaffMenuContent align="end">
        <StaffMenuItem disabled={shown === 0} onSelect={() => onExport("shown")}>
          {filtered ? `The ${shown} shown, as CSV` : `All ${total} ${noun}, as CSV`}
        </StaffMenuItem>
        {filtered ? (
          <StaffMenuItem onSelect={() => onExport("all")}>
            All {total} {noun}, as CSV
          </StaffMenuItem>
        ) : null}
      </StaffMenuContent>
    </StaffMenu>
  );
}
