import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { PageSkeleton } from "@auction/ui/components/page-skeleton";

export default function DashboardCheckoutIndexLoading() {
  return (
    <DashboardPage>
      <PageSkeleton variant="table" />
    </DashboardPage>
  );
}
