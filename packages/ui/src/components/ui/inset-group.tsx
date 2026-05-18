import type * as React from "react";
import { cn } from "../../lib/utils.js";
import { Surface } from "./surface.js";

export type InsetGroupProps = {
  label?: string;
  footer?: string;
  children: React.ReactNode;
  className?: string;
};

/** iOS Settings-style grouped list container. */
export function InsetGroup({ label, footer, children, className }: InsetGroupProps) {
  return (
    <div className={cn("space-y-2", className)}>
      {label ? (
        <p className="px-4 font-label text-xs font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
          {label}
        </p>
      ) : null}
      <Surface variant="inset" padding="none">
        {children}
      </Surface>
      {footer ? <p className="px-4 font-body text-xs text-on-surface-variant">{footer}</p> : null}
    </div>
  );
}
