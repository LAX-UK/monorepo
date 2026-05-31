import { AdminListPageSkeleton } from "@/components/admin/admin-loading-skeletons";

export default function AdminOnboardingIssuesLoading() {
  return (
    <AdminListPageSkeleton
      title="Onboarding & verification queues"
      kpiTiles={0}
      showToolbar={false}
    />
  );
}
