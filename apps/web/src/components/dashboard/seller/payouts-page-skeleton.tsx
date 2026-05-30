import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardSkeleton } from "@/components/dashboard/primitives/dashboard-skeleton";

/** Loading skeleton matching seller payouts page regions. */
export function PayoutsPageSkeleton() {
  return (
    <DashboardPage className="space-y-5">
      <div className="animate-pulse space-y-2" aria-hidden>
        <div className="h-3 w-24 rounded bg-surface-container-high" />
        <div className="h-8 w-56 max-w-full rounded bg-surface-container-high" />
        <div className="h-4 w-full max-w-2xl rounded bg-surface-container-high" />
      </div>
      <div
        className="h-20 animate-pulse rounded-lg border border-outline-variant/30 bg-surface-container-high/40"
        aria-hidden
      />
      <div className="h-36 animate-pulse rounded-xl bg-surface-container-high/50" aria-hidden />
      <DashboardSkeleton variant="list" />
    </DashboardPage>
  );
}
