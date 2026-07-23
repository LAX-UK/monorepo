import { SubmissionDetailShell } from "@/components/admin/submission-detail/submission-detail-shell";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { getAdminLegalEntityById } from "@/lib/data/http/admin.server";
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
  const [submitterEntity, staffDocuments] = await Promise.all([
    submitterLegalEntityId
      ? getAdminLegalEntityById(submitterLegalEntityId).catch(() => null)
      : Promise.resolve(null),
    getServerSubmissionDocuments(id),
  ]);
  const submitterDisplayName = submitterEntity?.displayName ?? null;

  return (
    <SubmissionDetailShell
      submissionId={s.id}
      submission={s}
      title={s.title}
      documentCount={staffDocuments.length}
      submitterLegalEntityId={submitterLegalEntityId}
      submitterDisplayName={submitterDisplayName}
      currentUserId={user.id}
    >
      {children}
    </SubmissionDetailShell>
  );
}
