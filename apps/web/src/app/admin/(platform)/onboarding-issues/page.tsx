import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { AdminListPage } from "@/components/admin/admin-list-page";
import { OnboardingIssuesBoard } from "@/components/admin/onboarding-issues-board";
import { getAdminOnboardingIssues } from "@/lib/data/http/admin.server";

export default async function AdminOnboardingIssuesPage() {
  let data: Awaited<ReturnType<typeof getAdminOnboardingIssues>> | null = null;
  let loadError: string | null = null;
  try {
    data = await getAdminOnboardingIssues();
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load onboarding queues.";
  }

  return (
    <AdminListPage
      title="Onboarding & verification queues"
      description="Operational queues surfaced on the admin home dashboard (DSE20)."
      errorAlert={
        loadError ? (
          <AdminListAlert title="Could not load queues">{loadError}</AdminListAlert>
        ) : undefined
      }
      view={data ? <OnboardingIssuesBoard data={data} /> : null}
    />
  );
}
