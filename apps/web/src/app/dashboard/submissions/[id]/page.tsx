import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardSliceErrorAlert } from "@/components/dashboard/dashboard-slice-error-alert";
import { DashboardDetailHeader } from "@/components/dashboard/primitives/dashboard-detail-header";
import { SubmissionDetailSplit } from "@/components/dashboard/submission-detail-split";
import { SubmissionWizard } from "@/components/dashboard/submission-wizard/submission-wizard";
import { SubmissionWorkflowActions } from "@/components/dashboard/submission-workflow-actions";
import { SubmissionStatusBadge } from "@/components/ui/submission-status-badge";
import {
  describeDashboardSliceFailure,
  describeSettingsActionError,
} from "@/lib/dashboard/dashboard-fetch-errors";
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
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const actionError = sp.error ? decodeURIComponent(sp.error) : null;
  const c = await getServerDataContainer();

  let s: Awaited<ReturnType<typeof c.submissions.getMineById>> = null;
  let loadFailure = null as ReturnType<typeof describeDashboardSliceFailure> | null;
  let categoriesFailure = null as ReturnType<typeof describeDashboardSliceFailure> | null;
  let categories: Awaited<ReturnType<typeof c.categories.tree>> = [];

  const [submissionRes, categoriesRes] = await Promise.allSettled([
    c.submissions.getMineById(id),
    c.categories.tree(),
  ]);

  if (submissionRes.status === "fulfilled") {
    s = submissionRes.value;
  } else {
    loadFailure = describeDashboardSliceFailure(
      submissionRes.reason,
      "submissions",
      "Could not load this submission.",
    );
  }

  if (categoriesRes.status === "fulfilled") {
    categories = categoriesRes.value;
  } else {
    categoriesFailure = describeDashboardSliceFailure(
      categoriesRes.reason,
      "categories",
      "Could not load categories.",
    );
  }

  if (!loadFailure && !s) notFound();

  if (loadFailure) {
    return (
      <DashboardPage className="mx-auto max-w-4xl space-y-8">
        <DashboardDetailHeader
          track="selling"
          backHref="/dashboard/submissions"
          backLabel="Submissions"
          eyebrow="Submission"
          title="Submission"
        />
        <DashboardSliceErrorAlert failure={loadFailure} />
      </DashboardPage>
    );
  }

  if (!s) notFound();

  const submission = s;
  const editable = submission.status === "draft";
  const canSubmit = submission.status === "draft";
  const canWithdraw = submission.status === "draft" || submission.status === "submitted";

  return (
    <DashboardPage className="mx-auto max-w-4xl space-y-8">
      <DashboardDetailHeader
        track="selling"
        backHref="/dashboard/submissions"
        backLabel="Submissions"
        eyebrow="Submission"
        title={submission.title}
        badges={<SubmissionStatusBadge status={submission.status} />}
      />
      {actionError ? (
        <DashboardSliceErrorAlert failure={describeSettingsActionError(actionError)} />
      ) : null}
      {categoriesFailure ? <DashboardSliceErrorAlert failure={categoriesFailure} /> : null}
      <TimelineStages
        stages={SUBMISSION_TIMELINE_STAGES}
        activeIndex={submissionTimelineActiveIndex(submission.status)}
        className="mb-2"
      />
      {editable ? (
        <SubmissionWizard
          mode={{ kind: "edit", submissionId: submission.id }}
          categories={categories}
          initialValues={itemSubmissionToFormValues(submission)}
        />
      ) : (
        <SubmissionDetailSplit
          title={submission.title}
          status={submission.status}
          images={submission.images}
          metaSlot={
            <div className="space-y-4">
              <Surface
                variant="section"
                className="space-y-4 font-body text-sm text-on-surface-variant"
              >
                <p>{submission.description ?? "No description."}</p>
                {submission.rejectionReason ? (
                  <p className="text-error">
                    <span className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)]">
                      Reason
                    </span>
                    <br />
                    {submission.rejectionReason}
                  </p>
                ) : null}
                {submission.reviewNotes ? (
                  <p>
                    <span className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)]">
                      Reviewer notes
                    </span>
                    <br />
                    {submission.reviewNotes}
                  </p>
                ) : null}
                {submission.convertedLotId ? (
                  <p>
                    View listing:{" "}
                    <Link
                      href={lotPath({ id: submission.convertedLotId, title: submission.title })}
                      className="text-primary underline"
                    >
                      Open artwork page
                    </Link>
                  </p>
                ) : null}
              </Surface>
              <SubmissionWorkflowActions
                submissionId={submission.id}
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
