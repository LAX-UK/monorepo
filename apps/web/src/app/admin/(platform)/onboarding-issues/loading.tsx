import { ListPageSkeleton } from "@auction/staff-ui";

export default function AdminOnboardingIssuesLoading() {
  return (
    <ListPageSkeleton
      title="Onboarding issues"
      description="Entities, artists, KYC sessions, lead organisations and documents waiting on staff."
      metrics={3}
      columns={["Entity", "Status", "Waiting", "Created"]}
    />
  );
}
