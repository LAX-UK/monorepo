import { AdminSubmissionDecisionPanel } from "@/components/admin/admin-submission-decision-panel";
import { CatalogDetailActionError } from "@/components/admin/catalog/catalog-detail-action-error";
import { SubmissionDecisionTab } from "@/components/admin/submission-detail/tabs/decision-tab";
import { loadAdminSubmissionDecisionPage } from "@/lib/admin/submissions/load-submission-decision-page";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { SUBMISSIONS_ACCESS } from "@/lib/navigation/staff-nav-access";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function AdminSubmissionDecisionPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireAdminCapability(SUBMISSIONS_ACCESS, `/admin/submissions/${id}`);
  const loaded = await loadAdminSubmissionDecisionPage(id, user.id);
  if (!loaded) notFound();

  const { submission, submitterDisplayName, submitterUserId } = loaded;

  const decision = (
    <AdminSubmissionDecisionPanel
      submissionId={submission.id}
      status={submission.status}
      submission={{
        title: submission.title,
        images: submission.images,
        description: submission.description,
        provenance: submission.provenance ?? [],
        categoryId: submission.categoryId,
        ...(submission.categoryIds ? { categoryIds: submission.categoryIds } : {}),
        convertedLotId: submission.convertedLotId,
      }}
      {...(submitterDisplayName ? { submitterDisplayName } : {})}
      {...(submitterUserId ? { submitterUserId } : {})}
    />
  );

  return (
    <>
      <CatalogDetailActionError error={sp.error} title="Could not update submission" />
      <SubmissionDecisionTab decision={decision} />
    </>
  );
}
