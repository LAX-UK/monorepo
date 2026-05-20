import { cn } from "@auction/ui";
import type { PageHeaderProps } from "@auction/ui/components/page-header";
import type { ReactNode } from "react";

export type DashboardPageHeaderProps = Omit<PageHeaderProps, "title"> & {
  title: ReactNode;
  meta?: ReactNode;
  /** `display` — larger welcome-style title on overview. */
  titleScale?: "default" | "display";
};

/** Opinionated dashboard page header — single h1 source per page. */
export function DashboardPageHeader({
  meta,
  title,
  titleScale = "default",
  className,
  description,
  breadcrumbs,
  actions,
}: DashboardPageHeaderProps) {
  const metaNode =
    meta && typeof meta === "string" ? (
      <span className="font-label text-[11px] font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
        {meta}
      </span>
    ) : (
      meta
    );

  const titleClass =
    titleScale === "display"
      ? "font-headline text-3xl font-semibold tracking-tight text-on-surface md:text-4xl"
      : "font-headline text-2xl font-semibold tracking-tight text-on-surface md:text-3xl";

  return (
    <div
      className={cn(
        "mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between md:gap-6",
        "mb-0 border-0 pb-0",
        className,
      )}
    >
      <div className="w-full md:flex-1 md:pr-8">
        {breadcrumbs ? (
          <div className="mb-4 text-on-surface-variant [&_a]:text-primary [&_a]:underline-offset-4 hover:[&_a]:underline">
            {breadcrumbs}
          </div>
        ) : null}
        {metaNode ? <div className="mb-2 text-on-surface-variant">{metaNode}</div> : null}
        <h1 className={titleClass}>{title}</h1>
        {description ? (
          <p className="mt-2 max-w-2xl font-body text-sm text-on-surface-variant">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
