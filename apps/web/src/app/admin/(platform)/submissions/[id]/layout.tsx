import { SubmissionDetailShell } from "@/components/admin/submission-detail/submission-detail-shell";
import { loadListRecordPager, requestListQuery } from "@/lib/admin/list-record-pager.server";
import { loadSubmissionAssigneeContext } from "@/lib/admin/submissions/load-submission-assignee";
import { loadAdminSubmissionDetailContext } from "@/lib/admin/submissions/load-submission-detail-context";
import { loadSubmissionUnreadMessages } from "@/lib/admin/submissions/load-submission-messages-page";
import { loadSubmissionsListIds } from "@/lib/admin/submissions/load-submissions-list-page";
import { submissionHref } from "@/lib/admin/submissions/submissions-staff-list.vm";
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
  const [assignee, unreadMessages, pager] = await Promise.all([
    loadSubmissionAssigneeContext(submission.assignedToUserId, user.id),
    loadSubmissionUnreadMessages(id),
    // Opened from the submissions list: Previous and Next through that list.
    requestListQuery().then((listQuery) =>
      loadListRecordPager({
        listQuery,
        currentId: submission.id,
        recordHref: submissionHref,
        loadIds: loadSubmissionsListIds,
      }),
    ),
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
      pager={pager}
    >
      {children}
    </SubmissionDetailShell>
  );
}
