import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardSliceErrorAlert } from "@/components/dashboard/dashboard-slice-error-alert";
import { DashboardDetailHeader } from "@/components/dashboard/primitives/dashboard-detail-header";
import { SellerOrgContextBanner } from "@/components/dashboard/seller-org-context-banner";
import { SubmissionDetailLiveRefresh } from "@/components/dashboard/submission-detail-live-refresh";
import { SubmissionDetailSplit } from "@/components/dashboard/submission-detail-split";
import { SubmissionLotReadyChecklist } from "@/components/dashboard/submission-lot-ready-checklist";
import { SubmissionRejectionPanel } from "@/components/dashboard/submission-rejection-panel";
import { SubmissionSellerDocumentsPanel } from "@/components/dashboard/submission-seller-documents-panel";
import { SubmissionWizard } from "@/components/dashboard/submission-wizard/submission-wizard";
import { SubmissionWorkflowActions } from "@/components/dashboard/submission-workflow-actions";
import { SetMobileShellTitle } from "@/components/layout/set-mobile-shell-title";
import { SubmissionStatusBadge } from "@/components/ui/submission-status-badge";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { DASHBOARD_ROUTES } from "@/lib/dashboard/dashboard-copy";
import {
  describeDashboardSliceFailure,
  describeSettingsActionError,
} from "@/lib/dashboard/dashboard-fetch-errors";
import { getServerDataContainer } from "@/lib/data/container.server";
import { getServerStripeConnectStatus } from "@/lib/data/http/stripe-connect.server";
import { getServerSubmissionDocuments } from "@/lib/data/http/submission-documents.server";
import { itemSubmissionToFormValues } from "@/lib/forms/submission/item-submission-form-defaults";
import {
  firstIncompleteWizardStepIndex,
  wizardStepIndex,
} from "@/lib/forms/submission/step-validation";
import { resolveSellerWorkspaceContext } from "@/lib/legal-entity/seller-acting-context.server";
import { lotPath } from "@/lib/seo/url";
import {
  SUBMISSION_TIMELINE_STAGES,
  submissionTimelineActiveIndex,
} from "@/lib/submissions/submission-timeline";
import { evaluateSubmissionQuality } from "@auction/domain";
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
  const user = await requireAuthenticatedUser({
    shell: "client",
    loginNext: `/dashboard/submissions/${id}`,
  });
  const { orgActingSelected, sellerEntityId } = await resolveSellerWorkspaceContext(
    user.role,
    user.staffRole ?? null,
  );
  const c = await getServerDataContainer();

  let s: Awaited<ReturnType<typeof c.submissions.getMineById>> = null;
  let loadFailure = null as ReturnType<typeof describeDashboardSliceFailure> | null;
  let categoriesFailure = null as ReturnType<typeof describeDashboardSliceFailure> | null;
  let categories: Awaited<ReturnType<typeof c.categories.tree>> = [];

  const [submissionRes, categoriesRes, documentsRes] = await Promise.allSettled([
    c.submissions.getMineById(id),
    c.categories.tree(),
    getServerSubmissionDocuments(id),
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
          compactOnMobile
          track="selling"
          backHref={DASHBOARD_ROUTES.submissions}
          backLabel="Submissions"
          title="Could not load submission"
        />
        <DashboardSliceErrorAlert failure={loadFailure} />
      </DashboardPage>
    );
  }

  if (!s) notFound();

  let documentsFailure = null as ReturnType<typeof describeDashboardSliceFailure> | null;
  if (documentsRes.status === "rejected") {
    documentsFailure = describeDashboardSliceFailure(
      documentsRes.reason,
      "submissions",
      "Could not load supporting documents.",
    );
  }
  const submissionDocuments = documentsRes.status === "fulfilled" ? documentsRes.value : [];

  const submission = s;

  let convertedLot: Awaited<ReturnType<typeof c.buyerLots.getById>> = null;
  let connectRequired = false;
  const needsConnectCheck =
    submission.status === "approved" ||
    submission.status === "converted" ||
    Boolean(submission.convertedLotId);
  if (submission.convertedLotId) {
    convertedLot = await c.buyerLots.getById(submission.convertedLotId).catch(() => null);
  }
  if (needsConnectCheck && sellerEntityId) {
    const connectStatus = await getServerStripeConnectStatus(sellerEntityId).catch(() => null);
    connectRequired =
      connectStatus == null || !connectStatus.ok || !connectStatus.data.payoutsEnabled;
  }

  const editable = submission.status === "draft";
  const canSubmit = submission.status === "draft";
  const canWithdraw = submission.status === "draft" || submission.status === "submitted";
  const submissionFormValues = itemSubmissionToFormValues(submission);
  const submissionQuality = evaluateSubmissionQuality(submission);
  const readyToSubmit = editable && submissionQuality.canSubmit;
  const wizardInitialStepIndex = readyToSubmit
    ? wizardStepIndex("review")
    : firstIncompleteWizardStepIndex(submissionFormValues);

  return (
    <DashboardPage className="mx-auto max-w-4xl space-y-8">
      <SetMobileShellTitle title={submission.title} />
      <DashboardDetailHeader
        compactOnMobile
        track="selling"
        backHref="/dashboard/submissions"
        backLabel="Submissions"
        title={submission.title}
        badges={<SubmissionStatusBadge status={submission.status} />}
      />
      {orgActingSelected ? <SellerOrgContextBanner /> : null}
      {actionError ? (
        <DashboardSliceErrorAlert failure={describeSettingsActionError(actionError)} />
      ) : null}
      {categoriesFailure ? <DashboardSliceErrorAlert failure={categoriesFailure} /> : null}
      <SubmissionDetailLiveRefresh status={submission.status} />
      {!editable ? (
        <>
          <TimelineStages
            stages={SUBMISSION_TIMELINE_STAGES}
            activeIndex={submissionTimelineActiveIndex(
              submission.status,
              convertedLot?.status ?? null,
            )}
            className="mb-2"
          />
        </>
      ) : null}
      <SubmissionRejectionPanel submission={submission} />
      <SubmissionLotReadyChecklist
        submission={submission}
        lot={convertedLot}
        connectRequired={connectRequired}
      />
      <SubmissionSellerDocumentsPanel
        submissionId={submission.id}
        status={submission.status}
        initialDocuments={submissionDocuments}
        loadFailure={documentsFailure}
      />
      {editable ? (
        <>
          <SubmissionWizard
            mode={{ kind: "edit", submissionId: submission.id }}
            categories={categoriesFailure ? [] : categories}
            initialValues={submissionFormValues}
            initialStepIndex={wizardInitialStepIndex}
            readyToSubmit={readyToSubmit}
          />
        </>
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
                {submission.status !== "rejected" && submission.reviewNotes ? (
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
                      className="text-link underline"
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
