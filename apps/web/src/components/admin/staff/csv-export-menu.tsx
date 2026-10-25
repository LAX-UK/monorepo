"use client";

import {
  StaffButton,
  StaffMenu,
  StaffMenuContent,
  StaffMenuItem,
  StaffMenuTrigger,
} from "@auction/staff-ui";
import { ChevronDown, Download } from "lucide-react";

type Props = {
  /** What a row is, in the plural: "documents", "media items". */
  noun: string;
  /** Rows the current search and filter show. */
  shown: number;
  total: number;
  onExport: (scope: "shown" | "all") => void;
};

/**
 * Export as CSV, following the search and filters in force: "the 3 shown" first, then
 * "all 12" when they differ. Offered only when there is something to export.
 */
export function CsvExportMenu({ noun, shown, total, onExport }: Props) {
  if (total === 0) return null;
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
