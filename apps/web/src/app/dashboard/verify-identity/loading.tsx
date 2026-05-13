import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { PageSkeleton } from "@auction/ui/components/page-skeleton";

export default function DashboardVerifyIdentityLoading() {
  return (
    <DashboardPage className="mx-auto max-w-3xl space-y-6">
      <PageSkeleton variant="table" />
    </DashboardPage>
  );
}
