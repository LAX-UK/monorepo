import type * as React from "react";
import { cn } from "../../lib/utils.js";

export type PageHeaderProps = {
  title: string;
  description?: string;
  /** Eyebrow / metadata above title */
  meta?: React.ReactNode;
  /** Rendered above the title (e.g. breadcrumb trail). */
  breadcrumbs?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
};

export function PageHeader({
  title,
  description,
  meta,
  breadcrumbs,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "mb-10 flex flex-col gap-5 border-b border-outline-variant/15 pb-8 md:flex-row md:items-start md:justify-between md:gap-8",
        className,
      )}
    >
      <div className="w-full md:flex-1 md:pr-8">
        {breadcrumbs ? (
          <div className="mb-4 text-on-surface-variant [&_a]:text-primary [&_a]:underline-offset-4 hover:[&_a]:underline">
            {breadcrumbs}
          </div>
        ) : null}
        {meta ? <div className="mb-2 text-on-surface-variant">{meta}</div> : null}
        <h1 className="font-headline text-4xl font-semibold tracking-tight text-on-surface md:text-5xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-3 w-full max-w-5xl font-body text-sm leading-relaxed text-on-surface-variant">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex w-full shrink-0 flex-wrap gap-2 md:w-auto md:justify-end">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
