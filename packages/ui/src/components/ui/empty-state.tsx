import type * as React from "react";
import { cn } from "../../lib/utils.js";

export type EmptyStateProps = {
  icon?: React.ReactNode;
  /** Larger decorative slot (illustration, empty artwork, etc.) */
  illustration?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
};

export function EmptyState({
  icon,
  illustration,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-outline-variant/25 bg-surface-container-low/40 px-8 py-16 text-center",
        className,
      )}
    >
      {illustration ? (
        <div className="mb-6 max-w-xs text-on-surface-variant [&_svg]:max-h-32">{illustration}</div>
      ) : null}
      {icon ? <div className="mb-4 text-primary [&_svg]:size-12">{icon}</div> : null}
      <h3 className="font-headline text-xl text-on-surface">{title}</h3>
      {description ? (
        <p className="mt-2 max-w-md text-sm text-on-surface-variant">{description}</p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
