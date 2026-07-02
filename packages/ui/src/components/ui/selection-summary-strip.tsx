"use client";

import type { ReactNode } from "react";
import { cn } from "../../lib/utils.js";
import { Surface } from "./surface.js";

export type SelectionSummaryStripProps = {
  /** Primary line, e.g. "Joining as Individual". */
  children: ReactNode;
  onChange?: () => void;
  changeLabel?: string;
  className?: string;
};

/** Compact summary of a prior wizard choice with an optional change action. */
export function SelectionSummaryStrip({
  children,
  onChange,
  changeLabel = "Change",
  className,
}: SelectionSummaryStripProps) {
  return (
    <Surface
      variant="quiet"
      padding="sm"
      className={cn("border border-outline-variant/40", className)}
      data-testid="selection-summary-strip"
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <p className="font-body text-sm text-on-surface">{children}</p>
        {onChange ? (
          <button
            type="button"
            className="font-footer-links text-sm text-link underline-offset-2 hover:underline"
            onClick={onChange}
          >
            {changeLabel}
          </button>
        ) : null}
      </div>
    </Surface>
  );
}
