import { StaffActionError } from "@/components/admin/staff/staff-action-error";
import { SubmissionOverviewTab } from "@/components/admin/submission-detail/tabs/overview-tab";
import { loadAdminSubmissionOverviewPage } from "@/lib/admin/submissions/load-submission-overview-page";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { SUBMISSIONS_READ_ACCESS } from "@/lib/navigation/staff-nav-access";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function AdminSubmissionOverviewPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireAdminCapability(SUBMISSIONS_READ_ACCESS, `/admin/submissions/${id}`);
  const model = await loadAdminSubmissionOverviewPage(id, user.id);
  if (!model) notFound();

  return (
    <>
      <StaffActionError error={sp.error} title="The submission was not updated" />
      <SubmissionOverviewTab
        submissionId={id}
        submission={model.submission}
        documentCount={model.documentCount}
        avgQueueAgeDays={model.avgQueueAgeDays}
        categories={model.categories}
        activityEvents={model.activityEvents}
      />
    </>
  );
}
