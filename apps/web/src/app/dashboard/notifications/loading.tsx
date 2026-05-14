import { DashboardSkeleton } from "@/components/dashboard/primitives/dashboard-skeleton";

export default function NotificationsLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <DashboardSkeleton variant="list" />
    </div>
  );
}
