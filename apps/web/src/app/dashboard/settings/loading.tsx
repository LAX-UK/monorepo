import { PageSkeleton } from "@auction/ui/components/page-skeleton";

/** Settings layout already provides outer `screen` chrome; keep this lightweight. */
export default function DashboardSettingsLoading() {
  return <PageSkeleton variant="table" />;
}
