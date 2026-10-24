"use client";

import { X } from "lucide-react";
import * as React from "react";
import { cn } from "../lib/cn.js";
import { StaffButton } from "../primitives/button.js";

/**
 * True inside a table while rows are selected. Row-level menus read it and step aside, so the
 * bulk actions are the only actions on offer until the selection is cleared.
 */
const TableSelectionContext = React.createContext(false);

export const TableSelectionProvider = TableSelectionContext.Provider;

export function useTableSelectionActive(): boolean {
  return React.useContext(TableSelectionContext);
}

const COUNT = new Intl.NumberFormat("en-GB");

/**
 * Appears when rows are selected, pinned to the bottom of the table's viewport so actions stay in
 * reach while scrolling. Says how many are selected, offers the actions that apply to all of
 * them, and a way to clear the selection (also Escape from the table). While it shows, the page
 * reserves its height at the bottom (`data-staff-bulk-bar`), so a focused row is never under it.
 */
export function BulkActionBar({
  count,
  noun = { one: "row", other: "rows" },
  onClear,
  scopeAction,
  allMatching = false,
  children,
  className,
}: {
  count: number;
  noun?: { one: string; other: string };
  onClear: () => void;
  /**
   * A control that widens or narrows the selection, beside the count: "Select all 312 matching"
   * or, on a phone, "Select all".
   */
  scopeAction?: React.ReactNode;
  /** The selection is every row matching the filters: the count reads "All 312 orders". */
  allMatching?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  if (count === 0) return null;
  const word = count === 1 ? noun.one : noun.other;
  return (
    <div
      data-staff-bulk-bar=""
      className={cn(
        "pointer-events-none sticky bottom-4 z-20 flex justify-center px-2 pt-3",
        className,
      )}
    >
      <section
        aria-label="Bulk actions"
        className="pointer-events-auto flex w-full max-w-full items-center gap-1 rounded-staff-md border border-staff-line bg-staff-raised p-1 pl-3 shadow-staff-md sm:w-auto"
      >
        <p className="mr-1 text-staff-sm font-medium whitespace-nowrap text-staff-fg tabular-nums sm:mr-2">
          {allMatching ? "All " : null}
          {COUNT.format(count)} <span className="sr-only sm:not-sr-only">{word} </span>
          selected
        </p>
        {scopeAction ? <div className="flex shrink-0 items-center">{scopeAction}</div> : null}
        <span aria-hidden className="mx-1 h-5 w-px bg-staff-line" />
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none] sm:flex-none">
          {children}
        </div>
        <span aria-hidden className="mx-1 h-5 w-px bg-staff-line" />
        <StaffButton variant="ghost" size="icon-sm" aria-label="Clear selection" onClick={onClear}>
          <X aria-hidden />
        </StaffButton>
      </section>
    </div>
  );
}
