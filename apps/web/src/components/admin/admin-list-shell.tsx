import { AdminListToolbar } from "@/components/admin/admin-list-toolbar";
import { AppScreen } from "@/components/dashboard/dashboard-page";
import { DashboardPageHeader } from "@/components/dashboard/primitives/dashboard-page-header";
import { EntityList } from "@auction/ui";
import { cn } from "@auction/ui";
import type { ReactNode } from "react";

/**
 * Staff list-page layout shell (presentation only).
 *
 * SOLID layering — reference: `/admin/disputes`
 * 1. `page.tsx` — orchestrates shell props; no column defs or label maps.
 * 2. `*ListController` in `admin-list-controllers.ts` — `parseQuery` + `fetch` (DIP).
 * 3. `*.vm.ts` view-models — row shaping and display labels.
 * 4. `*-board/` — `EntityList`, columns, mobile-cards, drawer; accepts view-model rows only.
 *    Drawer previews: human fields in the main body; technical IDs via `AdminTechnicalIdDisclosure`.
 * 5. Presenters — `status-badge-variants`, `domain-event-labels`, `capability-presenter`.
 *
 * Variants: `queue` for work queues; `layout="hub"` for lookup/settings (no pagination).
 * Checklist: kpiStrip, mobileCards or board EntityList, illustrated empty, loading.tsx sibling.
 */
export type AdminListShellVariant = "default" | "overview" | "report" | "queue";
export type AdminListShellLayout = "list" | "hub";

export type AdminListShellProps = {
  title: ReactNode;
  description?: string;
  variant?: AdminListShellVariant;
  /** Hub layout renders `view` directly (lookup/settings surfaces). */
  layout?: AdminListShellLayout;
  breadcrumbs?: ReactNode;
  primaryAction?: ReactNode;
  meta?: ReactNode;
  /** Sticky region immediately below the page header (catalog filter bar). */
  headerAfter?: ReactNode;
  kpiStrip?: ReactNode;
  /** One-line summary on mobile when kpiStrip is hidden */
  mobileSummary?: ReactNode;
  /** Row below KPI strip (catalog export / period toggle). */
  postKpiToolbarEnd?: ReactNode;
  /** View lenses / status chips — sticky above filter toolbar */
  chips?: ReactNode;
  savedViews?: ReactNode;
  /** Search + Filters drawer toolbar (`filtersSelfContained` when toolbar includes its own sheet). */
  filters?: ReactNode;
  filtersSelfContained?: boolean;
  toolbarEnd?: ReactNode;
  listToolbarEnd?: ReactNode;
  hasFilters?: boolean;
  resetHref?: string;
  errorAlert?: ReactNode;
  bulkBar?: ReactNode;
  view: ReactNode;
  mobileCards?: ReactNode;
  pagination?: ReactNode;
  empty?: ReactNode;
  /** When false, `view` renders directly (boards that include their own EntityList). */
  wrapView?: boolean;
  /** Focus target when closing URL-owned list previews opened via deep link. */
  listHeadingId?: string;
  className?: string;
};

const variantSpacing: Record<AdminListShellVariant, string> = {
  default: "space-y-6",
  overview: "space-y-8",
  report: "space-y-8",
  queue: "space-y-4",
};

/** Shared admin list layout: header, KPI, sticky filters, table/cards, pagination. */
export function AdminListShell({
  title,
  description,
  variant = "default",
  layout = "list",
  breadcrumbs,
  primaryAction,
  meta,
  headerAfter,
  kpiStrip,
  mobileSummary,
  postKpiToolbarEnd,
  chips,
  savedViews,
  filters,
  filtersSelfContained = false,
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
  wrapView = true,
  className,
  listHeadingId,
}: AdminListShellProps) {
  const isHub = layout === "hub";
  const showToolbar = Boolean(savedViews || filters || toolbarEnd || listToolbarEnd);
  const showEmpty = Boolean(empty);
  const showResults = isHub || !showEmpty;

  return (
    <AppScreen
      className={cn(
        "mx-auto w-full max-w-7xl bg-transparent pb-8 md:space-y-8",
        variantSpacing[variant],
        className,
      )}
    >
      <DashboardPageHeader
        title={title}
        {...(listHeadingId ? { listHeadingId } : {})}
        {...(description ? { description } : {})}
        {...(meta ? { meta } : {})}
        {...(breadcrumbs ? { breadcrumbs } : {})}
        {...(primaryAction ? { actions: primaryAction } : {})}
      />
      {headerAfter}
      {mobileSummary ? (
        <div className="lg:hidden" aria-live="polite">
          {mobileSummary}
        </div>
      ) : null}
      {kpiStrip ? <div className="hidden lg:block">{kpiStrip}</div> : null}
      {postKpiToolbarEnd}
      {chips || filters || showToolbar ? (
        <div className="sticky top-0 z-20 -mx-1 space-y-3 bg-surface/95 px-1 py-2 backdrop-blur-sm supports-[backdrop-filter]:bg-surface/80">
          {chips}
          {showToolbar ? (
            <AdminListToolbar
              filters={filters}
              filtersSelfContained={filtersSelfContained}
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
          ) : null}
        </div>
      ) : null}
      {bulkBar}
      {errorAlert}
      {isHub ? (
        view
      ) : showResults ? (
        wrapView ? (
          <EntityList
            responsiveMode={mobileCards ? "auto" : "scroll"}
            {...(mobileCards ? { cards: mobileCards, table: view } : { table: view })}
          />
        ) : (
          view
        )
      ) : null}
      {!isHub && showEmpty ? empty : null}
      {pagination}
    </AppScreen>
  );
}
