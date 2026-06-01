import type * as React from "react";
import { cn } from "../../lib/utils.js";

export type ToolbarProps = React.HTMLAttributes<HTMLDivElement> & {
  search?: React.ReactNode;
  filters?: React.ReactNode;
  views?: React.ReactNode;
  actions?: React.ReactNode;
  /** When false, search slot renders as div (avoids nested search landmarks). */
  searchLandmark?: boolean;
  searchLabel?: string;
};

/** Unified list/toolbar chrome: search | filters | views | actions.
 * Slots are optional; layout wraps on small screens.
 */
export function Toolbar({
  className,
  search,
  filters,
  views,
  actions,
  searchLandmark = true,
  searchLabel = "Filter list",
  ...props
}: ToolbarProps) {
  if (!search && !filters && !views && !actions) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl border border-outline-variant/15 bg-surface-container-lowest/90 p-4 shadow-sm ring-1 ring-outline-variant/10 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between",
        className,
      )}
      {...props}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        {search ? (
          searchLandmark ? (
            <search className="min-w-0 flex-1 sm:max-w-md" aria-label={searchLabel}>
              {search}
            </search>
          ) : (
            <div className="min-w-0 flex-1 sm:max-w-md">{search}</div>
          )
        ) : null}
        {filters ? <div className="flex flex-wrap items-center gap-2">{filters}</div> : null}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {views ? <div className="flex flex-wrap items-center gap-2">{views}</div> : null}
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
