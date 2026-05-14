import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardSkeleton } from "@/components/dashboard/primitives/dashboard-skeleton";

export default function DashboardPortfolioLoading() {
  return (
    <DashboardPage className="space-y-8">
      <DashboardSkeleton variant="grid" />
    </DashboardPage>
  );
}
