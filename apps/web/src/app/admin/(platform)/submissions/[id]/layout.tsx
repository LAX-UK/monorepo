import { SubmissionDetailShell } from "@/components/admin/submission-detail/submission-detail-shell";
import { loadSubmissionAssigneeContext } from "@/lib/admin/submissions/load-submission-assignee";
import { loadAdminSubmissionDetailContext } from "@/lib/admin/submissions/load-submission-detail-context";
import { loadSubmissionUnreadMessages } from "@/lib/admin/submissions/load-submission-messages-page";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { SUBMISSIONS_READ_ACCESS } from "@/lib/navigation/staff-nav-access";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

type Props = {
  params: Promise<{ id: string }>;
  children: ReactNode;
};

export default async function AdminSubmissionDetailLayout({ params, children }: Props) {
  const { id } = await params;
  const user = await requireAdminCapability(SUBMISSIONS_READ_ACCESS, `/admin/submissions/${id}`);
  const context = await loadAdminSubmissionDetailContext(id);
  if (!context) notFound();

  const { submission, submitterLegalEntityId, submitterDisplayName, documentCount } = context;
  const [assignee, unreadMessages] = await Promise.all([
    loadSubmissionAssigneeContext(submission.assignedToUserId, user.id),
    loadSubmissionUnreadMessages(id),
  ]);

  return (
    <SubmissionDetailShell
      submissionId={submission.id}
      submission={submission}
      title={submission.title}
      documentCount={documentCount}
      unreadMessages={unreadMessages}
      submitterLegalEntityId={submitterLegalEntityId}
      submitterDisplayName={submitterDisplayName}
      assigneeDisplayName={assignee.assigneeDisplayName}
      currentUserId={user.id}
    >
      {children}
    </SubmissionDetailShell>
  );
}
