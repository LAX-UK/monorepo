import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { PageSkeleton } from "@auction/ui/components/page-skeleton";

export default function DashboardTeamLoading() {
  return (
    <DashboardPage>
      <PageSkeleton variant="table" />
    </DashboardPage>
  );
}
