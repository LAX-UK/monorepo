import { ConnectWorkspaceSkeleton } from "@/components/connect/connect-workspace-skeleton";
import { DashboardPage } from "@/components/dashboard/dashboard-page";

/** Loading skeleton matching seller connect page layout. */
export function ConnectPageSkeleton() {
  return (
    <DashboardPage className="space-y-5">
      <div
        className="animate-pulse space-y-2"
        aria-hidden
        data-testid="connect-page-header-skeleton"
      >
        <div className="h-3 w-24 rounded bg-surface-container-high" />
        <div className="h-8 w-48 max-w-full rounded bg-surface-container-high" />
        <div className="h-4 w-full max-w-xl rounded bg-surface-container-high" />
      </div>
      <ConnectWorkspaceSkeleton />
    </DashboardPage>
  );
}
