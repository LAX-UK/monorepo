import { StaffHubShell } from "@/components/admin/catalog/staff-hub-shell";
import { Skeleton } from "@auction/ui/components/skeleton";

export default function PersonalDashboardLoading() {
  return (
    <StaffHubShell
      title="Good day"
      description="Your queue, then the context you need to resolve it."
      primaryAction={<Skeleton className="h-9 w-28 rounded-md" />}
      kpiStrip={
        <div className="hidden lg:block">
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      }
      mobileSummary={
        <div className="flex gap-3">
          <Skeleton className="h-10 w-24 rounded-md" />
        </div>
      }
      view={
        <div className="space-y-10" aria-busy="true" aria-label="Loading dashboard">
          <Skeleton className="h-[28rem] w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      }
    />
  );
}
