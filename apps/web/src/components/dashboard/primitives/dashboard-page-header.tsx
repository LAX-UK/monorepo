import { cn } from "@auction/ui";
import type { PageHeaderProps } from "@auction/ui/components/page-header";
import type { ReactNode } from "react";

export type DashboardPageHeaderProps = Omit<PageHeaderProps, "title"> & {
  title: ReactNode;
  meta?: ReactNode;
  /** `display` — larger welcome-style title on overview. */
  titleScale?: "default" | "display";
  /** Hide h1 below lg when shell breadcrumb shows the current page. */
  hideTitleOnMobile?: boolean;
  /** Hide description below lg to reduce vertical stack on list pages. */
  hideDescriptionOnMobile?: boolean;
};

/** Opinionated dashboard page header — single h1 source per page. */
export function DashboardPageHeader({
  meta,
  title,
  titleScale = "default",
  hideTitleOnMobile = false,
  hideDescriptionOnMobile = false,
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
      ? "font-headline text-3xl font-semibold tracking-tight text-on-surface lg:text-4xl"
      : "font-headline text-2xl font-semibold tracking-tight text-on-surface lg:text-3xl";

  return (
    <div
      className={cn(
        "mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-6",
        "mb-0 border-0 pb-0",
        className,
      )}
    >
      <div className="w-full lg:flex-1 lg:pr-8">
        {breadcrumbs ? (
          <div className="mb-4 text-on-surface-variant [&_a]:text-primary [&_a]:underline-offset-4 hover:[&_a]:underline">
            {breadcrumbs}
          </div>
        ) : null}
        {metaNode ? <div className="mb-2 text-on-surface-variant">{metaNode}</div> : null}
        <h1
          className={cn(
            titleClass,
            hideTitleOnMobile &&
              "sr-only lg:not-sr-only lg:static lg:h-auto lg:w-auto lg:overflow-visible lg:clip-auto lg:whitespace-normal",
          )}
        >
          {title}
        </h1>
        {description ? (
          <p
            className={cn(
              "mt-2 max-w-2xl font-body text-sm text-on-surface-variant",
              hideDescriptionOnMobile && "hidden lg:block",
            )}
          >
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
