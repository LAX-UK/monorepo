import { AdminListToolbar } from "@/components/admin/admin-list-toolbar";
import { CommandPaletteHint } from "@/components/admin/command-palette-hint";
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
  /** Export, column picker, etc. — shown in the list toolbar beside reset. */
  listToolbarEnd?: ReactNode;
  hasFilters?: boolean | undefined;
  resetHref?: string | undefined;
  errorAlert?: ReactNode;
  bulkBar?: ReactNode;
  view: ReactNode;
  pagination?: ReactNode;
  empty?: ReactNode;
  /** When true, appends command palette hint below the empty slot. */
  showCommandPaletteHint?: boolean;
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
  listToolbarEnd,
  hasFilters,
  resetHref,
  errorAlert,
  bulkBar,
  view,
  pagination,
  empty,
  showCommandPaletteHint = false,
  className,
}: AdminListPageProps) {
  const showToolbar = Boolean(filters || toolbarEnd || listToolbarEnd);
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
        responsiveMode="scroll"
        filters={
          showToolbar ? (
            <AdminListToolbar
              filters={filters}
              extra={toolbarEnd}
              toolbarEnd={listToolbarEnd}
              hasFilters={Boolean(hasFilters)}
              resetHref={resetHref ?? ""}
            />
          ) : undefined
        }
        table={view}
        {...(errorAlert ? { error: errorAlert } : {})}
      />
      {empty}
      {showCommandPaletteHint ? <CommandPaletteHint className="mt-2" /> : null}
      {pagination}
    </AppScreen>
  );
}
