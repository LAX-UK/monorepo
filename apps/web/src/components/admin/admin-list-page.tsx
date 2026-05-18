import { AdminListToolbar } from "@/components/admin/admin-list-toolbar";
import { AppScreen } from "@/components/dashboard/dashboard-page";
import { DashboardPageHeader } from "@/components/dashboard/primitives/dashboard-page-header";
import { EntityList } from "@auction/ui";
import type { ReactNode } from "react";

export type AdminListPageProps = {
  title: string;
  description?: string | undefined;
  breadcrumbs?: ReactNode;
  primaryAction?: ReactNode;
  meta?: ReactNode;
  chips?: ReactNode;
  filters?: ReactNode;
  toolbarEnd?: ReactNode;
  hasFilters?: boolean | undefined;
  resetHref?: string | undefined;
  errorAlert?: ReactNode;
  bulkBar?: ReactNode;
  view: ReactNode;
  pagination?: ReactNode;
  empty?: ReactNode;
  className?: string | undefined;
};

/** Shared staff list layout: header, optional chips/filters, toolbar (share/reset), view, pagination. */
export function AdminListPage({
  title,
  description,
  breadcrumbs,
  primaryAction,
  meta,
  chips,
  filters,
  toolbarEnd,
  hasFilters,
  resetHref,
  errorAlert,
  bulkBar,
  view,
  pagination,
  empty,
  className,
}: AdminListPageProps) {
  const showToolbar = Boolean(filters || toolbarEnd);
  return (
    <AppScreen className={className ?? "space-y-6"}>
      <DashboardPageHeader
        title={title}
        {...(description ? { description } : {})}
        {...(meta ? { meta } : {})}
        {...(breadcrumbs ? { breadcrumbs } : {})}
        {...(primaryAction ? { actions: primaryAction } : {})}
      />
      {chips}
      {bulkBar}
      <EntityList
        filters={
          showToolbar ? (
            <AdminListToolbar
              filters={filters}
              extra={toolbarEnd}
              hasFilters={Boolean(hasFilters)}
              resetHref={resetHref ?? ""}
            />
          ) : undefined
        }
        table={view}
        {...(errorAlert ? { error: errorAlert } : {})}
      />
      {empty}
      {pagination}
    </AppScreen>
  );
}
