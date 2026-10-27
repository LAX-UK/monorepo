import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardSkeleton } from "@/components/dashboard/primitives/dashboard-skeleton";

export default function OrganisationsLoading() {
  return (
    <DashboardPage>
      <div className="mx-auto max-w-5xl">
        <DashboardSkeleton variant="dashboard" />
      </div>
    </DashboardPage>
  );
}
