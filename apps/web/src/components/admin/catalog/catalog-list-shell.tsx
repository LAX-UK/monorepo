import type { AdminListShellVariant } from "@/components/admin/admin-list-shell";
import { AdminListShell } from "@/components/admin/admin-list-shell";
import { cn } from "@auction/ui";
import type { ReactNode } from "react";

type Props = {
  title: ReactNode;
  description?: string;
  variant?: AdminListShellVariant;
  breadcrumbs?: ReactNode;
  primaryAction?: ReactNode;
  meta?: ReactNode;
  filterBar?: ReactNode;
  chips?: ReactNode;
  hasFilters?: boolean;
  resetHref?: string;
  filters?: ReactNode;
  filtersSelfContained?: boolean;
  listToolbarEnd?: ReactNode;
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

const catalogStickyChrome =
  "sticky top-0 z-20 -mx-1 space-y-3 bg-shell-page-bg/95 px-1 py-2 backdrop-blur-sm supports-[backdrop-filter]:bg-shell-page-bg/80";

/**
 * Catalog list layout — opinionated defaults for catalog module pages:
 * sticky lens/filter chrome, hero KPI band spacing, boards own table/card split.
 */
export function CatalogListShell({
  title,
  description,
  variant = "default",
  breadcrumbs,
  primaryAction,
  meta,
  filterBar,
  chips,
  hasFilters,
  resetHref,
  filters,
  filtersSelfContained,
  listToolbarEnd,
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
      className={cn("pb-10", className)}
      variant={variant}
      title={title}
      {...(description ? { description } : {})}
      {...(breadcrumbs ? { breadcrumbs } : {})}
      {...(primaryAction ? { primaryAction } : {})}
      {...(meta ? { meta } : {})}
      {...(filterBar
        ? {
            headerAfter: <div className={catalogStickyChrome}>{filterBar}</div>,
          }
        : {})}
      {...(chips ? { chips } : {})}
      {...(hasFilters != null ? { hasFilters } : {})}
      {...(resetHref ? { resetHref } : {})}
      {...(filters ? { filters } : {})}
      {...(filtersSelfContained ? { filtersSelfContained } : {})}
      {...(listToolbarEnd ? { listToolbarEnd } : {})}
      kpiStrip={kpiStrip ? <div className="space-y-6">{kpiStrip}</div> : undefined}
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
