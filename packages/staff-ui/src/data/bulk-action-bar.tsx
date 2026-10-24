"use client";

import { X } from "lucide-react";
import type * as React from "react";
import { cn } from "../lib/cn.js";
import { StaffButton } from "../primitives/button.js";

/**
 * Appears when rows are selected, pinned to the bottom of the table's viewport so actions stay in
 * reach while scrolling. Says how many are selected, offers the actions that apply to all of
 * them, and a way to clear the selection (also Escape from the table).
 */
export function BulkActionBar({
  count,
  noun = { one: "row", other: "rows" },
  onClear,
  children,
  className,
}: {
  count: number;
  noun?: { one: string; other: string };
  onClear: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  if (count === 0) return null;
  return (
    <div
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
          {count}{" "}
          <span className="sr-only sm:not-sr-only">{count === 1 ? noun.one : noun.other} </span>
          selected
        </p>
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
