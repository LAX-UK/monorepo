import type * as React from "react";
import { cn } from "../../lib/utils.js";

export type PageHeaderProps = {
  title: string;
  description?: string;
  /** Eyebrow / metadata above title */
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
};

export function PageHeader({ title, description, meta, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        "mb-10 flex flex-col gap-4 border-b border-outline-variant/10 pb-8 md:flex-row md:items-end md:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        {meta ? <div className="mb-2 text-on-surface-variant">{meta}</div> : null}
        <h1 className="font-headline text-3xl tracking-tight text-on-surface md:text-4xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm text-on-surface-variant">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
