import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardSkeleton } from "@/components/dashboard/primitives/dashboard-skeleton";

export default function SellerArtistLoading() {
  return (
    <DashboardPage>
      <DashboardSkeleton variant="dashboard" />
    </DashboardPage>
  );
}
