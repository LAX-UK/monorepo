import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardSkeleton } from "@/components/dashboard/primitives/dashboard-skeleton";

export default function DashboardCheckoutIndexLoading() {
  return (
    <DashboardPage>
      <DashboardSkeleton variant="list" />
    </DashboardPage>
  );
}
