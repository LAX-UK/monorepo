import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { PageSkeleton } from "@auction/ui/components/page-skeleton";

export default function DashboardPortfolioLoading() {
  return (
    <DashboardPage className="space-y-8">
      <PageSkeleton variant="grid" />
    </DashboardPage>
  );
}
