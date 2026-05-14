import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardSkeleton } from "@/components/dashboard/primitives/dashboard-skeleton";

export default function DashboardArtistFollowLoading() {
  return (
    <DashboardPage>
      <DashboardSkeleton variant="grid" />
    </DashboardPage>
  );
}
