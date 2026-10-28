import { AdminSubmissionDecisionPanel } from "@/components/admin/admin-submission-decision-panel";
import { StaffActionError } from "@/components/admin/staff/staff-action-error";
import { SubmissionDecisionTab } from "@/components/admin/submission-detail/tabs/decision-tab";
import { loadAdminSubmissionDecisionPage } from "@/lib/admin/submissions/load-submission-decision-page";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { getAdminConsignmentView } from "@/lib/data/http/consignment-agreements.server";
import { SUBMISSIONS_ACCESS } from "@/lib/navigation/staff-nav-access";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function AdminSubmissionDecisionPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  await requireAdminCapability(SUBMISSIONS_ACCESS, `/admin/submissions/${id}`);
  const loaded = await loadAdminSubmissionDecisionPage(id);
  if (!loaded) notFound();

  const { submission, submitterDisplayName, submitterUserId } = loaded;
  // Accepting waits for the seller's identity; cataloguing for their acceptance of the terms.
  const sellerView =
    submission.status === "under_review" || submission.status === "approved"
      ? await getAdminConsignmentView(submission.id).catch(() => null)
      : null;

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
      agreement={sellerView?.agreement ?? null}
      sellerIdentityVerified={sellerView?.sellerIdentityVerified ?? true}
      {...(submission.legalEntityId ? { sellerLegalEntityId: submission.legalEntityId } : {})}
    />
  );

  return (
    <>
      <StaffActionError error={sp.error} title="The submission was not updated" />
      <SubmissionDecisionTab decision={decision} />
    </>
  );
}
