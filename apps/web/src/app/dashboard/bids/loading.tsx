import { DashboardSkeleton } from "@/components/dashboard/primitives/dashboard-skeleton";

export default function DashboardBidsLoading() {
  return (
    <div className="mx-auto w-full max-w-[var(--container-inner,1376px)] py-6">
      <DashboardSkeleton variant="list" />
    </div>
  );
}
