import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardSkeleton } from "@/components/dashboard/primitives/dashboard-skeleton";

export default function DashboardSubmissionsLoading() {
  return (
    <DashboardPage>
      <DashboardSkeleton variant="list" />
    </DashboardPage>
  );
}
