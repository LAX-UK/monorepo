import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardSliceErrorAlert } from "@/components/dashboard/dashboard-slice-error-alert";
import { DashboardDetailHeader } from "@/components/dashboard/primitives/dashboard-detail-header";
import { ConsignmentAgreementPanel } from "@/components/dashboard/seller/consignment-agreement-panel";
import { ConsignmentChecklist } from "@/components/dashboard/seller/consignment-checklist";
import { ConsignmentWithdrawPanel } from "@/components/dashboard/seller/consignment-withdraw-panel";
import { SubmissionChangesRequestedPanel } from "@/components/dashboard/seller/submission-changes-requested-panel";
import { UnsoldLotChoicePanel } from "@/components/dashboard/seller/unsold-lot-choice-panel";
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
import { getServerConsignmentAfterSale } from "@/lib/data/http/consignment-after-sale.server";
import { getServerConsignmentAgreement } from "@/lib/data/http/consignment-agreements.server";
import { getServerStripeConnectStatus } from "@/lib/data/http/stripe-connect.server";
import { getServerSubmissionDocuments } from "@/lib/data/http/submission-documents.server";
import { itemSubmissionToFormValues } from "@/lib/forms/submission/item-submission-form-defaults";
import {
  firstIncompleteWizardStepIndex,
  wizardStepIndex,
} from "@/lib/forms/submission/step-validation";
import { openRecordInItsAccount } from "@/lib/legal-entity/open-record-in-account.server";
import { resolveSellerWorkspaceContext } from "@/lib/legal-entity/seller-acting-context.server";
import {
  CONDITIONS_OF_BUSINESS_PART_C,
  partCSection,
} from "@/lib/legal/conditions-of-business-part-c";
import { checklistItemView } from "@/lib/seller/consignment-checklist-copy";
import { consignmentChecklistFacts } from "@/lib/seller/consignment-checklist-facts";
import { consignmentWithdrawalViewModel } from "@/lib/seller/consignment-withdrawal-view";
import { loadSellerAccountFacts } from "@/lib/seller/seller-account-facts.server";
import { unsoldChoiceViewModel } from "@/lib/seller/unsold-choice-view";
import { lotPath } from "@/lib/seo/url";
import {
  SUBMISSION_TIMELINE_STAGES,
  submissionTimelineActiveIndex,
} from "@/lib/submissions/submission-timeline";
import {
  computeConsignmentChecklist,
  evaluateSubmissionQuality,
  sellerCanEditSubmission,
} from "@auction/domain";
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
    loginNext: `/selling/consignments/${id}`,
  });
  const sellerCtx = await resolveSellerWorkspaceContext(user.role, user.staffRole ?? null);
  const { sellerEntityId } = sellerCtx;
  const c = await getServerDataContainer();

  let s: Awaited<ReturnType<typeof c.submissions.getMineById>> = null;
  let loadFailure = null as ReturnType<typeof describeDashboardSliceFailure> | null;
  let categoriesFailure = null as ReturnType<typeof describeDashboardSliceFailure> | null;
  let categories: Awaited<ReturnType<typeof c.categories.tree>> = [];

  const [submissionRes, categoriesRes, documentsRes, agreementRes, accountRes, afterSaleRes] =
    await Promise.allSettled([
      c.submissions.getMineById(id),
      c.categories.tree(),
      getServerSubmissionDocuments(id),
      getServerConsignmentAgreement(id),
      loadSellerAccountFacts(sellerCtx),
      getServerConsignmentAfterSale(id),
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

  if (!s) {
    // Not in this account: a link to another account's consignment switches to it, or explains
    // there is no access.
    await openRecordInItsAccount({
      kind: "consignment",
      id,
      actingId: sellerEntityId,
      next: `/selling/consignments/${id}`,
    });
  }
  if (!loadFailure && !s) notFound();

  if (loadFailure) {
    return (
      <DashboardPage className="mx-auto max-w-4xl space-y-8">
        <DashboardDetailHeader
          compactOnMobile
          backHref={DASHBOARD_ROUTES.consignments}
          backLabel="Consignments"
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

  const editable = sellerCanEditSubmission(submission.status);
  const canSubmit = submission.status === "draft";
  const agreementView = agreementRes.status === "fulfilled" ? agreementRes.value : null;
  const account = accountRes.status === "fulfilled" ? accountRes.value : null;
  const checklist = account
    ? computeConsignmentChecklist(
        consignmentChecklistFacts({
          submission,
          agreement: agreementView?.agreement ?? null,
          account,
          lot: convertedLot,
        }),
      )
    : null;
  const accountName = account?.organisationName ?? user.name;
  const afterSale = afterSaleRes.status === "fulfilled" ? afterSaleRes.value : null;
  const unsoldView = afterSale?.unsold
    ? unsoldChoiceViewModel(afterSale.unsold, {
        organisationName: account?.organisationName ?? null,
      })
    : null;
  const unsoldCurrent = afterSale?.unsold?.choice?.requestedChoice
    ? {
        choice: afterSale.unsold.choice.requestedChoice,
        reserve: afterSale.unsold.choice.requestedReserve,
      }
    : null;
  const withdrawalView = afterSale ? consignmentWithdrawalViewModel(afterSale.withdrawal) : null;
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
        backHref={DASHBOARD_ROUTES.consignments}
        backLabel="Consignments"
        title={submission.title}
        badges={<SubmissionStatusBadge status={submission.status} />}
      />
      {actionError ? (
        <DashboardSliceErrorAlert failure={describeSettingsActionError(actionError)} />
      ) : null}
      {categoriesFailure ? <DashboardSliceErrorAlert failure={categoriesFailure} /> : null}
      <SubmissionDetailLiveRefresh status={submission.status} />
      <SubmissionChangesRequestedPanel submission={submission} />
      {checklist?.applies && account ? (
        <ConsignmentChecklist
          items={checklist.items.map((item) =>
            checklistItemView(item, {
              accountKind: account.accountKind,
              organisationName: account.organisationName,
              agreementHref: "#agreement",
            }),
          )}
          doneCount={checklist.doneCount}
          totalCount={checklist.totalCount}
        />
      ) : null}
      {unsoldView ? (
        <UnsoldLotChoicePanel
          submissionId={submission.id}
          view={unsoldView}
          current={unsoldCurrent}
        />
      ) : null}
      {agreementView?.agreement && account ? (
        <ConsignmentAgreementPanel
          agreement={agreementView.agreement}
          canAccept={agreementView.canAccept}
          accountName={accountName}
          accountKind={account.accountKind}
          conditions={CONDITIONS_OF_BUSINESS_PART_C}
        />
      ) : null}
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
            {...(submission.status === "changes_requested"
              ? { submitLabel: "Send back for review" }
              : {})}
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
                    <span className="font-label text-xs font-semibold text-on-surface">
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
                canWithdraw={false}
              />
              {withdrawalView ? (
                <ConsignmentWithdrawPanel
                  submissionId={submission.id}
                  view={withdrawalView}
                  terms={partCSection("withdrawal-by-seller")}
                />
              ) : null}
            </div>
          }
        />
      )}
    </DashboardPage>
  );
}
