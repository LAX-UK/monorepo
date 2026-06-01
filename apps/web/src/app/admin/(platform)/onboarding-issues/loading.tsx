import { PeopleListPageSkeleton } from "@/components/admin/people/people-list-states";

export default function AdminOnboardingIssuesLoading() {
  return (
    <PeopleListPageSkeleton
      title="Onboarding & verification queues"
      description="Loading queues…"
      kpiTiles={0}
      showFilterBar={false}
      showTabBar
    />
  );
}
