import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { PageSkeleton } from "@auction/ui/components/page-skeleton";

export default function DashboardArtistFollowLoading() {
  return (
    <DashboardPage>
      <PageSkeleton variant="grid" />
    </DashboardPage>
  );
}
