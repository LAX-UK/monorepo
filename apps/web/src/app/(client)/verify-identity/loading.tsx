import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardSkeleton } from "@/components/dashboard/primitives/dashboard-skeleton";

export default function DashboardVerifyIdentityLoading() {
  return (
    <DashboardPage className="mx-auto max-w-3xl space-y-6">
      <DashboardSkeleton variant="list" />
    </DashboardPage>
  );
}
