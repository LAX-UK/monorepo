import { DashboardSkeleton } from "@/components/dashboard/primitives/dashboard-skeleton";

/** Settings layout already provides outer `screen` chrome; keep this lightweight. */
export default function DashboardSettingsLoading() {
  return <DashboardSkeleton variant="list" />;
}
