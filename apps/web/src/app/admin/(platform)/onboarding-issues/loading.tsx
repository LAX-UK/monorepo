import { AdminListPage } from "@/components/admin/admin-list-page";
import { TabbedQueueSkeleton } from "@/components/admin/admin-loading-skeletons";

export default function OnboardingIssuesLoading() {
  return (
    <AdminListPage
      title="Onboarding issues"
      description="Loading queues…"
      hasFilters={false}
      resetHref="/admin/onboarding-issues"
      view={<TabbedQueueSkeleton tabs={5} />}
    />
  );
}
