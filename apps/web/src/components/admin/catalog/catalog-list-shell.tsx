import { AppScreen } from "@/components/dashboard/dashboard-page";
import { cn } from "@auction/ui";
import type { ReactNode } from "react";
import { CatalogPageHeader } from "./catalog-page-header";

type Props = {
  title: ReactNode;
  description?: string;
  breadcrumbs?: ReactNode;
  primaryAction?: ReactNode;
  meta?: ReactNode;
  filterBar?: ReactNode;
  kpiStrip?: ReactNode;
  /** One-line summary on mobile when kpiStrip is hidden */
  mobileSummary?: ReactNode;
  toolbarEnd?: ReactNode;
  errorAlert?: ReactNode;
  children: ReactNode;
  empty?: ReactNode;
  pagination?: ReactNode;
  className?: string;
};

/** Catalog list layout — header, lenses, results; mobile-first. */
export function CatalogListShell({
  title,
  description,
  breadcrumbs,
  primaryAction,
  meta,
  filterBar,
  kpiStrip,
  mobileSummary,
  toolbarEnd,
  errorAlert,
  children,
  empty,
  pagination,
  className,
}: Props) {
  return (
    <AppScreen className={cn("mx-auto w-full max-w-7xl space-y-6 pb-8 md:space-y-8", className)}>
      <CatalogPageHeader
        title={title}
        {...(description ? { description } : {})}
        {...(breadcrumbs ? { breadcrumbs } : {})}
        {...(meta ? { meta } : {})}
        actions={primaryAction}
      />
      {filterBar}
      {mobileSummary ? <div className="md:hidden">{mobileSummary}</div> : null}
      {kpiStrip ? <div className="hidden md:block">{kpiStrip}</div> : null}
      {toolbarEnd ? (
        <div className="flex flex-wrap items-center justify-end gap-2">{toolbarEnd}</div>
      ) : null}
      {errorAlert}
      {children}
      {empty}
      {pagination}
    </AppScreen>
  );
}
