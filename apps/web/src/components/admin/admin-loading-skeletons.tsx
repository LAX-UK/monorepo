import { AdminDetailSkeleton } from "@/components/admin/admin-detail-skeleton";
import { AdminListShell } from "@/components/admin/admin-list-shell";
import { TableSkeleton } from "@auction/ui";
import { Skeleton } from "@auction/ui/components/skeleton";

const KPI_TILE_KEYS = ["kpi-0", "kpi-1", "kpi-2", "kpi-3", "kpi-4", "kpi-5"] as const;
const KANBAN_COLUMN_KEYS = ["col-0", "col-1", "col-2", "col-3", "col-4", "col-5"] as const;
const KANBAN_CARD_KEYS = ["card-0", "card-1", "card-2"] as const;
const TAB_KEYS = ["tab-0", "tab-1", "tab-2", "tab-3", "tab-4", "tab-5"] as const;

type ListSkeletonProps = {
  title: string;
  description?: string;
  kpiTiles?: number;
  tableRows?: number;
  tableColumns?: number;
  showFilterBar?: boolean;
  showReadinessBand?: boolean;
  showTabBar?: boolean;
  showMobileCards?: boolean;
};

export type AdminListPageSkeletonProps = ListSkeletonProps;

export function KpiStripSkeleton({ tiles }: { tiles: number }) {
  return (
    <div
      className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4"
      aria-busy="true"
      aria-label="Loading summary"
    >
      {KPI_TILE_KEYS.slice(0, tiles).map((id) => (
        <Skeleton key={id} className="h-20 w-full rounded-lg" />
      ))}
    </div>
  );
}

export function AdminListFilterBarSkeleton() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Skeleton className="h-9 w-48 rounded-full" />
      <Skeleton className="h-9 w-32 rounded-full" />
      <Skeleton className="h-9 w-24 rounded-md" />
    </div>
  );
}

function MobileCardsSkeleton() {
  return (
    <div className="space-y-3 lg:hidden">
      {["card-0", "card-1", "card-2"].map((id) => (
        <Skeleton key={id} className="h-28 w-full rounded-lg" />
      ))}
    </div>
  );
}

/** Matches admin list shell + KPI strip + toolbar + table. */
export function AdminListPageSkeleton({
  title,
  description = "Loading…",
  kpiTiles = 4,
  tableRows = 10,
  tableColumns = 6,
  showFilterBar = true,
  showReadinessBand = false,
  showTabBar = false,
  showMobileCards = false,
}: ListSkeletonProps) {
  const showFilters = showFilterBar;

  return (
    <AdminListShell
      title={title}
      description={description}
      hasFilters={false}
      resetHref="#"
      kpiStrip={kpiTiles > 0 ? <KpiStripSkeleton tiles={kpiTiles} /> : null}
      filters={showFilters && !showTabBar ? <AdminListFilterBarSkeleton /> : null}
      wrapView={false}
      view={
        showTabBar ? (
          <TabbedQueueSkeleton tabs={5} />
        ) : (
          <div className="space-y-4" aria-busy="true">
            {showReadinessBand ? <Skeleton className="h-24 w-full rounded-lg" /> : null}
            {showMobileCards ? <MobileCardsSkeleton /> : null}
            <div className={showMobileCards ? "hidden lg:block" : undefined}>
              <TableSkeleton rows={tableRows} columns={tableColumns} />
            </div>
          </div>
        )
      }
      pagination={<Skeleton className="h-10 w-full max-w-md" />}
    />
  );
}

/** Saleroom / conveyor kanban columns. */
export function KanbanSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4" aria-busy="true" aria-label="Loading pipeline">
      {KANBAN_COLUMN_KEYS.slice(0, columns).map((id) => (
        <KanbanColumnSkeleton key={id} />
      ))}
    </div>
  );
}

function KanbanColumnSkeleton() {
  return (
    <div className="min-w-[14rem] shrink-0 space-y-3 rounded-lg border border-border-hairline bg-surface-container-low/30 p-3">
      <Skeleton className="h-5 w-24" />
      {KANBAN_CARD_KEYS.map((id) => (
        <Skeleton key={id} className="h-20 w-full rounded-md" />
      ))}
    </div>
  );
}

/** Legal entity lookup / search panel. */
export function LookupPanelSkeleton() {
  return (
    <div className="mx-auto max-w-xl space-y-6" aria-busy="true">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-4 w-full max-w-md" />
      <Skeleton className="h-12 w-full rounded-lg" />
      <Skeleton className="h-32 w-full rounded-lg" />
    </div>
  );
}

/** Xero / integration settings card. */
export function IntegrationPanelSkeleton() {
  return (
    <div className="mx-auto max-w-[560px] space-y-6" aria-busy="true">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-4 w-full" />
      <div className="space-y-3 rounded-lg border border-border-hairline p-6">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-10 w-40" />
      </div>
    </div>
  );
}

/** Saleroom clerk console blocks. */
export function ClerkConsoleSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading saleroom console">
      <AdminDetailSkeleton />
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-32 rounded-lg" />
        <Skeleton className="h-32 rounded-lg" />
      </div>
      <Skeleton className="h-48 w-full rounded-lg" />
    </div>
  );
}

/** Onboarding issues: tab bar + table. */
export function TabbedQueueSkeleton({ tabs = 5 }: { tabs?: number }) {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="flex gap-2 overflow-hidden">
        {TAB_KEYS.slice(0, tabs).map((id) => (
          <Skeleton key={id} className="h-9 w-28 shrink-0" />
        ))}
      </div>
      <TableSkeleton rows={8} columns={5} />
    </div>
  );
}

export { AdminDetailSkeleton };
