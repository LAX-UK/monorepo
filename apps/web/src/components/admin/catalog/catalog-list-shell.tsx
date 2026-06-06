import { AdminListShell } from "@/components/admin/admin-list-shell";
import type { ReactNode } from "react";

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

/**
 * Catalog list layout — adapter over `AdminListShell` preserving catalog prop names
 * and filter/KPI ordering. Boards own responsive table/card split (`wrapView={false}`).
 */
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
    <AdminListShell
      {...(className ? { className } : {})}
      title={title}
      {...(description ? { description } : {})}
      {...(breadcrumbs ? { breadcrumbs } : {})}
      {...(primaryAction ? { primaryAction } : {})}
      {...(meta ? { meta } : {})}
      {...(filterBar
        ? {
            headerAfter: (
              <div className="sticky top-0 z-20 -mx-1 space-y-3 bg-surface/95 px-1 py-2 backdrop-blur-sm supports-[backdrop-filter]:bg-surface/80">
                {filterBar}
              </div>
            ),
          }
        : {})}
      kpiStrip={kpiStrip}
      mobileSummary={mobileSummary}
      {...(toolbarEnd
        ? {
            postKpiToolbarEnd: (
              <div className="flex flex-wrap items-center justify-end gap-2">{toolbarEnd}</div>
            ),
          }
        : {})}
      errorAlert={errorAlert}
      view={children}
      wrapView={false}
      empty={empty}
      pagination={pagination}
    />
  );
}
