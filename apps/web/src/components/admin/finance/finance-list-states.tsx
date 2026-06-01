import { AdminListShell } from "@/components/admin/admin-list-shell";
import {
  AdminListPageSkeleton,
  type AdminListPageSkeletonProps,
} from "@/components/admin/admin-loading-skeletons";
import { AdminPanelPage } from "@/components/admin/admin-panel-page";
import { Skeleton } from "@auction/ui/components/skeleton";

export type FinanceListPageSkeletonProps = AdminListPageSkeletonProps & {
  showMobileCards?: boolean;
};

/** Loading state aligned with AdminListShell layout. */
export function FinanceListPageSkeleton({
  showMobileCards = true,
  ...props
}: FinanceListPageSkeletonProps) {
  return <AdminListPageSkeleton showMobileCards={showMobileCards} {...props} />;
}

const KPI_TILE_KEYS = ["kpi-0", "kpi-1", "kpi-2", "kpi-3", "kpi-4", "kpi-5"] as const;

/** Hub dashboard loading (finance home). */
export function FinanceHubPageSkeleton() {
  return (
    <AdminListShell
      layout="hub"
      title="Finance"
      description="Loading…"
      view={
        <div className="space-y-8" aria-busy="true">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {KPI_TILE_KEYS.slice(0, 4).map((id) => (
              <Skeleton key={id} className="h-20 w-full rounded-lg" />
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {["link-0", "link-1", "link-2", "link-3", "link-4", "link-5"].map((id) => (
              <Skeleton key={id} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        </div>
      }
    />
  );
}

/** Panel page loading (settlement, integrations). */
export function FinancePanelPageSkeleton({
  title,
  description = "Loading…",
  className,
}: {
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <AdminPanelPage title={title} description={description} className={className}>
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>
    </AdminPanelPage>
  );
}
