"use client";

import type * as React from "react";
import { cn } from "../../lib/utils.js";
import { Toolbar } from "./toolbar.js";

export type EntityTableResponsiveMode = "scroll" | "cards" | "auto";

export type EntityTableShellProps = {
  /** Top toolbar: search + actions */
  search?: React.ReactNode;
  toolbarEnd?: React.ReactNode;
  /** Filter chips (use snap-x snap-mandatory overflow-x-auto on parent) */
  filters?: React.ReactNode;
  /** Saved view dropdown, column picker, export, etc. */
  toolbarMeta?: React.ReactNode;
  responsiveMode?: EntityTableResponsiveMode;
  /** Table region (DataTable) — shown md+ when mode is auto, always when scroll */
  table: React.ReactNode;
  /** Card list — shown below md when auto; always when cards */
  cards?: React.ReactNode;
  density?: "comfortable" | "compact";
  className?: string;
};

/**
 * Wraps admin/user tables with a consistent toolbar and responsive table/card split.
 */
export function EntityTableShell({
  search,
  toolbarEnd,
  filters,
  toolbarMeta,
  responsiveMode = "auto",
  table,
  cards,
  density = "comfortable",
  className,
}: EntityTableShellProps) {
  const showTableAlways = responsiveMode === "scroll" || responsiveMode === "auto";
  const showCardsOnly = responsiveMode === "cards";
  const showAuto = responsiveMode === "auto";

  const pad = density === "compact" ? "py-2" : "py-3";

  return (
    <div className={cn("space-y-4", className)}>
      <Toolbar
        className={cn(
          "flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between",
          pad,
        )}
        search={search}
        filters={
          <div className="flex w-full min-w-0 flex-col gap-3">
            {filters ? (
              <div className="-mx-1 flex min-w-0 snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible">
                {filters}
              </div>
            ) : null}
            {toolbarMeta ? (
              <div className="flex min-w-0 flex-wrap items-center gap-2">{toolbarMeta}</div>
            ) : null}
          </div>
        }
      />
      {toolbarEnd ? (
        <div className="flex flex-wrap items-center justify-end gap-2">{toolbarEnd}</div>
      ) : null}

      {showCardsOnly && cards ? (
        <div className={density === "compact" ? "text-sm" : ""}>{cards}</div>
      ) : null}

      {responsiveMode === "scroll" ? (
        <div className={density === "compact" ? "text-sm" : ""}>{table}</div>
      ) : null}

      {showAuto ? (
        <>
          <div className={cn("hidden md:block", density === "compact" && "text-sm")}>{table}</div>
          {cards ? <div className="md:hidden">{cards}</div> : null}
        </>
      ) : null}
    </div>
  );
}
