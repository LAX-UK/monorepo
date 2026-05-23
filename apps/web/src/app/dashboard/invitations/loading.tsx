import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardSkeleton } from "@/components/dashboard/primitives/dashboard-skeleton";

export default function InvitationsLoading() {
  return (
    <DashboardPage>
      <div className="mx-auto max-w-5xl">
        <DashboardSkeleton variant="list" />
      </div>
    </DashboardPage>
  );
}
