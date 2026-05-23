import { AdminSubmissionDecisionPanel } from "@/components/admin/admin-submission-decision-panel";
import { CatalogDetailActionError } from "@/components/admin/catalog/catalog-detail-action-error";
import { SubmissionDecisionTab } from "@/components/admin/submission-detail/tabs/decision-tab";
import { getAdminLegalEntityById } from "@/lib/data/http/admin.server";
import { getAdminSubmissionById } from "@/lib/data/http/submissions.server";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function AdminSubmissionDecisionPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const s = await getAdminSubmissionById(id);
  if (!s) notFound();

  const submitterLegalEntityId = s.legalEntityId ?? s.sellerId ?? null;
  const submitterEntity = submitterLegalEntityId
    ? await getAdminLegalEntityById(submitterLegalEntityId).catch(() => null)
    : null;
  const submitterDisplayName = submitterEntity?.displayName ?? null;
  const submitterUserId = submitterEntity?.createdByUserId ?? null;

  const decision = (
    <AdminSubmissionDecisionPanel
      submissionId={s.id}
      status={s.status}
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
