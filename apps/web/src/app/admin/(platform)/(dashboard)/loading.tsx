import { AppScreen } from "@/components/dashboard/dashboard-page";
import { DashboardPageHeader } from "@/components/dashboard/primitives/dashboard-page-header";
import { LabelCaps } from "@auction/ui";
import { Skeleton } from "@auction/ui/components/skeleton";

const KPI_KEYS = ["kpi-0", "kpi-1", "kpi-2", "kpi-3"] as const;

export default function PersonalDashboardLoading() {
  return (
    <AppScreen>
      <div className="space-y-8" aria-busy="true" aria-label="Loading dashboard">
        <DashboardPageHeader
          title="Your dashboard"
          meta={<LabelCaps className="text-lot-orange">Admin · Personal</LabelCaps>}
          description="Trend-aware KPIs, attention items, anomalies, and saleroom pulse — layout saved on this device."
          actions={<Skeleton className="h-9 w-28 rounded-md" />}
        />

        <Skeleton className="h-14 w-full max-w-lg rounded-lg" />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {KPI_KEYS.map((id) => (
            <Skeleton key={id} className="h-24 w-full rounded-lg" />
          ))}
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <Skeleton className="h-72 rounded-lg lg:col-span-7" />
          <Skeleton className="h-72 rounded-lg lg:col-span-5" />
        </div>

        <Skeleton className="h-48 w-full rounded-lg" />
      </div>
    </AppScreen>
  );
}
