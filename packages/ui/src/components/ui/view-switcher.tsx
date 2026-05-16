"use client";

import { LayoutGrid, Rows3, Square } from "lucide-react";
import { cn } from "../../lib/utils.js";

export type CatalogLayoutView = "grid" | "card" | "list";

export type ViewSwitcherProps = {
  value: CatalogLayoutView;
  onValueChange: (value: CatalogLayoutView) => void;
  /** Omit a mode when not supported on this screen (e.g. sales calendar: no card). */
  modes?: readonly CatalogLayoutView[];
  disabled?: boolean;
  className?: string;
};

const DEFAULT_MODES: readonly CatalogLayoutView[] = ["grid", "card", "list"];

const ICONS: Record<CatalogLayoutView, typeof LayoutGrid> = {
  grid: LayoutGrid,
  card: Square,
  list: Rows3,
};

export function ViewSwitcher({
  value,
  onValueChange,
  modes = DEFAULT_MODES,
  disabled,
  className,
}: ViewSwitcherProps) {
  return (
    <div className={cn("inline-flex items-center gap-1", className)}>
      <span className="sr-only" aria-live="polite">
        {value === "grid" ? "Grid view" : value === "card" ? "Card view" : "List view"}
      </span>
      <div
        role="radiogroup"
        aria-label="View"
        className="inline-flex min-w-0 items-center gap-1 rounded-full border border-outline-variant/40 bg-surface-container-low p-1"
      >
        {modes.map((m) => {
          const Icon = ICONS[m];
          const selected = value === m;
          return (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onValueChange(m)}
              className={cn(
                "flex size-9 items-center justify-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-50 md:size-8",
                selected
                  ? "bg-primary text-on-primary"
                  : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
              )}
              title={m === "grid" ? "Grid" : m === "card" ? "Card" : "List"}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              <span className="sr-only">
                {m === "grid" ? "Grid" : m === "card" ? "Card" : "List"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
