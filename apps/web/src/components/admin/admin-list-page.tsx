import { AdminListToolbar } from "@/components/admin/admin-list-toolbar";
import { CommandPaletteHint } from "@/components/admin/command-palette-hint";
import { AppScreen } from "@/components/dashboard/dashboard-page";
import { DashboardPageHeader } from "@/components/dashboard/primitives/dashboard-page-header";
import { EntityList } from "@auction/ui";
import type { ReactNode } from "react";

export type AdminListPageVariant = "default" | "overview" | "report" | "queue";

export type AdminListPageProps = {
  title: string;
  description?: string | undefined;
  variant?: AdminListPageVariant;
  breadcrumbs?: ReactNode;
  primaryAction?: ReactNode;
  meta?: ReactNode;
  /** KPI strip — use AdminListKpiStrip only */
  kpiStrip?: ReactNode;
  chips?: ReactNode;
  /** Persisted saved-view chips (client); rendered in toolbar when set. */
  savedViews?: ReactNode;
  filters?: ReactNode;
  toolbarEnd?: ReactNode;
  listToolbarEnd?: ReactNode;
  hasFilters?: boolean | undefined;
  resetHref?: string | undefined;
  errorAlert?: ReactNode;
  bulkBar?: ReactNode;
  view: ReactNode;
  /** Mobile card fallback rendered below md when provided */
  mobileCards?: ReactNode;
  pagination?: ReactNode;
  empty?: ReactNode;
  showCommandPaletteHint?: boolean;
  className?: string | undefined;
};

const variantSpacing: Record<AdminListPageVariant, string> = {
  default: "space-y-6",
  overview: "space-y-8",
  report: "space-y-8",
  queue: "space-y-4",
};

/** Shared staff list layout: header, KPI, toolbar, view, mobile cards, pagination. */
export function AdminListPage({
  title,
  description,
  variant = "default",
  breadcrumbs,
  primaryAction,
  meta,
  kpiStrip,
  chips,
  savedViews,
  filters,
  toolbarEnd,
  listToolbarEnd,
  hasFilters,
  resetHref,
  errorAlert,
  bulkBar,
  view,
  mobileCards,
  pagination,
  empty,
  showCommandPaletteHint = false,
  className,
}: AdminListPageProps) {
  const showToolbar = Boolean(savedViews || filters || toolbarEnd || listToolbarEnd);

  return (
    <AppScreen className={className ?? variantSpacing[variant]}>
      <DashboardPageHeader
        title={title}
        {...(description ? { description } : {})}
        {...(meta ? { meta } : {})}
        {...(breadcrumbs ? { breadcrumbs } : {})}
        {...(primaryAction ? { actions: primaryAction } : {})}
      />
      {kpiStrip}
      {chips}
      {bulkBar}
      <EntityList
        responsiveMode={mobileCards ? "auto" : "scroll"}
        filters={
          showToolbar ? (
            <AdminListToolbar
              filters={filters}
              extra={toolbarEnd}
              toolbarEnd={
                savedViews || listToolbarEnd ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {savedViews}
                    {listToolbarEnd}
                  </div>
                ) : undefined
              }
              hasFilters={Boolean(hasFilters)}
              resetHref={resetHref ?? ""}
            />
          ) : undefined
        }
        table={
          mobileCards ? (
            <>
              <div className="hidden md:block">{view}</div>
              <div className="md:hidden">{mobileCards}</div>
            </>
          ) : (
            view
          )
        }
        {...(errorAlert ? { error: errorAlert } : {})}
      />
      {empty}
      {showCommandPaletteHint ? <CommandPaletteHint className="mt-2" /> : null}
      {pagination}
    </AppScreen>
  );
}
