import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardSkeleton } from "@/components/dashboard/primitives/dashboard-skeleton";

export default function CheckoutLoading() {
  return (
    <DashboardPage className="mx-auto max-w-[var(--container-inner,1376px)] space-y-0">
      <DashboardSkeleton variant="checkout" />
    </DashboardPage>
  );
}
