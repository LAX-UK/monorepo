import type * as React from "react";
import { cn } from "../../lib/utils.js";

export type ToolbarProps = React.HTMLAttributes<HTMLDivElement> & {
  search?: React.ReactNode;
  filters?: React.ReactNode;
  views?: React.ReactNode;
  actions?: React.ReactNode;
};

/** Unified list/toolbar chrome: search | filters | views | actions.
 * Slots are optional; layout wraps on small screens.
 */
export function Toolbar({ className, search, filters, views, actions, ...props }: ToolbarProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-outline-variant/15 bg-surface-container-lowest/80 p-3 ring-1 ring-outline-variant/10 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between",
        className,
      )}
      {...props}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        {search ? <div className="min-w-0 flex-1 sm:max-w-md">{search}</div> : null}
        {filters ? <div className="flex flex-wrap items-center gap-2">{filters}</div> : null}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {views ? <div className="flex flex-wrap items-center gap-2">{views}</div> : null}
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
