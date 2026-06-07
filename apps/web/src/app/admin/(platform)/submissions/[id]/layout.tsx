import { AdminSubmissionDecisionPanel } from "@/components/admin/admin-submission-decision-panel";
import { SubmissionDetailShell } from "@/components/admin/submission-detail/submission-detail-shell";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import {
  getAdminDomainEventsForAggregate,
  getAdminLegalEntityById,
} from "@/lib/data/http/admin.server";
import { getServerSubmissionDocuments } from "@/lib/data/http/submission-documents.server";
import { getAdminSubmissionById } from "@/lib/data/http/submissions.server";
import { SUBMISSIONS_ACCESS } from "@/lib/navigation/staff-nav-access";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

type Props = {
  params: Promise<{ id: string }>;
  children: ReactNode;
};

export default async function AdminSubmissionDetailLayout({ params, children }: Props) {
  const { id } = await params;
  const user = await requireAdminCapability(SUBMISSIONS_ACCESS, `/admin/submissions/${id}`);
  const s = await getAdminSubmissionById(id);
  if (!s) notFound();

  const submitterLegalEntityId = s.legalEntityId ?? s.sellerId ?? null;
  const [submitterEntity, staffDocuments, activityEvents] = await Promise.all([
    submitterLegalEntityId
      ? getAdminLegalEntityById(submitterLegalEntityId).catch(() => null)
      : Promise.resolve(null),
    getServerSubmissionDocuments(id),
    getAdminDomainEventsForAggregate({
      aggregateType: "submission",
      aggregateId: id,
      limit: 5,
    }).catch(() => []),
  ]);
  const submitterDisplayName = submitterEntity?.displayName ?? null;
  const submitterUserId = submitterEntity?.createdByUserId ?? null;

  const asideDecision = (
    <AdminSubmissionDecisionPanel
      submissionId={s.id}
      status={s.status}
      submission={{
        title: s.title,
        images: s.images,
        description: s.description,
        provenance: s.provenance ?? [],
        categoryId: s.categoryId,
        ...(s.categoryIds ? { categoryIds: s.categoryIds } : {}),
        convertedLotId: s.convertedLotId,
      }}
      {...(submitterDisplayName ? { submitterDisplayName } : {})}
      {...(submitterUserId ? { submitterUserId } : {})}
    />
  );

  return (
    <SubmissionDetailShell
      submissionId={s.id}
      submission={s}
      title={s.title}
      documentCount={staffDocuments.length}
      submitterLegalEntityId={submitterLegalEntityId}
      submitterDisplayName={submitterDisplayName}
      currentUserId={user.id}
      asideDecision={asideDecision}
      activityEvents={activityEvents}
    >
      {children}
    </SubmissionDetailShell>
  );
}
