import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardDetailHeader } from "@/components/dashboard/primitives/dashboard-detail-header";
import { SubmissionDetailSplit } from "@/components/dashboard/submission-detail-split";
import { SubmissionWizard } from "@/components/dashboard/submission-wizard/submission-wizard";
import { SubmissionWorkflowActions } from "@/components/dashboard/submission-workflow-actions";
import { SubmissionStatusBadge } from "@/components/ui/submission-status-badge";
import { getServerDataContainer } from "@/lib/data/container.server";
import { itemSubmissionToFormValues } from "@/lib/forms/submission/item-submission-form-defaults";
import { lotPath } from "@/lib/seo/url";
import {
  SUBMISSION_TIMELINE_STAGES,
  submissionTimelineActiveIndex,
} from "@/lib/submissions/submission-timeline";
import { Surface } from "@auction/ui/components/surface";
import { TimelineStages } from "@auction/ui/components/timeline-stages";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function SubmissionDetailPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await getServerDataContainer();
  const [s, categories] = await Promise.all([c.submissions.getMineById(id), c.categories.tree()]);
  if (!s) notFound();
  const editable = s.status === "draft";
  const canSubmit = s.status === "draft";
  const canWithdraw = s.status === "draft" || s.status === "submitted";

  return (
    <DashboardPage className="mx-auto max-w-4xl space-y-8">
      <DashboardDetailHeader
        track="selling"
        backHref="/dashboard/submissions"
        backLabel="Submissions"
        eyebrow="Submission"
        title={s.title}
        badges={<SubmissionStatusBadge status={s.status} />}
      />
      <TimelineStages
        stages={SUBMISSION_TIMELINE_STAGES}
        activeIndex={submissionTimelineActiveIndex(s.status)}
        className="mb-2"
      />
      {editable ? (
        <SubmissionWizard
          mode={{ kind: "edit", submissionId: s.id }}
          categories={categories}
          initialValues={itemSubmissionToFormValues(s)}
        />
      ) : (
        <SubmissionDetailSplit
          title={s.title}
          status={s.status}
          images={s.images}
          metaSlot={
            <div className="space-y-4">
              <Surface
                variant="section"
                className="space-y-4 font-body text-sm text-on-surface-variant"
              >
                <p>{s.description ?? "No description."}</p>
                {s.rejectionReason ? (
                  <p className="text-error">
                    <span className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)]">
                      Reason
                    </span>
                    <br />
                    {s.rejectionReason}
                  </p>
                ) : null}
                {s.reviewNotes ? (
                  <p>
                    <span className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)]">
                      Reviewer notes
                    </span>
                    <br />
                    {s.reviewNotes}
                  </p>
                ) : null}
                {s.convertedLotId ? (
                  <p>
                    View listing:{" "}
                    <Link
                      href={lotPath({ id: s.convertedLotId, title: s.title })}
                      className="text-primary underline"
                    >
                      Open artwork page
                    </Link>
                  </p>
                ) : null}
              </Surface>
              <SubmissionWorkflowActions
                submissionId={s.id}
                canSubmit={canSubmit}
                canWithdraw={canWithdraw}
              />
            </div>
          }
        />
      )}
    </DashboardPage>
  );
}
