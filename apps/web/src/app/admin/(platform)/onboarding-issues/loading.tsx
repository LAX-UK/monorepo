import { PeopleListPageSkeleton } from "@/components/admin/people/people-list-states";

export default function AdminOnboardingIssuesLoading() {
  return (
    <PeopleListPageSkeleton
      title="Onboarding issues"
      description="Loading onboarding issues…"
      kpiTiles={0}
      showFilterBar={false}
      showTabBar
    />
  );
}
