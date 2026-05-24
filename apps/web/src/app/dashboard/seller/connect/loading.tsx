import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardSkeleton } from "@/components/dashboard/primitives/dashboard-skeleton";

export default function SellerConnectLoading() {
  return (
    <DashboardPage className="mx-auto max-w-2xl">
      <DashboardSkeleton variant="dashboard" />
    </DashboardPage>
  );
}
