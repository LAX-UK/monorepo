import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardSliceErrorAlert } from "@/components/dashboard/dashboard-slice-error-alert";
import { AccountLoadError } from "@/components/dashboard/primitives/account-load-error";
import { ConsignmentAgreementPanel } from "@/components/dashboard/seller/consignment-agreement-panel";
import { ConsignmentChecklist } from "@/components/dashboard/seller/consignment-checklist";
import {
  AboutTheWork,
  AskYourSpecialist,
  ConsignmentDetailHead,
} from "@/components/dashboard/seller/consignment-detail-parts";
import { ConsignmentWithdrawPanel } from "@/components/dashboard/seller/consignment-withdraw-panel";
import { SubmissionChangesRequestedPanel } from "@/components/dashboard/seller/submission-changes-requested-panel";
import { SubmissionSubmittedNotice } from "@/components/dashboard/seller/submission-submitted-notice";
import { UnsoldLotChoicePanel } from "@/components/dashboard/seller/unsold-lot-choice-panel";
import { SubmissionDetailLiveRefresh } from "@/components/dashboard/submission-detail-live-refresh";
import { SubmissionLotReadyChecklist } from "@/components/dashboard/submission-lot-ready-checklist";
import { SubmissionRejectionPanel } from "@/components/dashboard/submission-rejection-panel";
import { SubmissionSellerDocumentsPanel } from "@/components/dashboard/submission-seller-documents-panel";
import { SubmissionWizard } from "@/components/dashboard/submission-wizard/submission-wizard";
import { SubmissionWorkflowActions } from "@/components/dashboard/submission-workflow-actions";
import { SetMobileShellTitle } from "@/components/layout/set-mobile-shell-title";
import { MediaImage } from "@/components/ui/media-image";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { formatLotMoment } from "@/lib/bid/lot-moment";
import { ACCOUNT_LOAD_ERROR, DASHBOARD_ROUTES } from "@/lib/dashboard/dashboard-copy";
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
import { consignmentActionsVm } from "@/lib/seller/consignment-actions.vm";
import { checklistItemView } from "@/lib/seller/consignment-checklist-copy";
import { consignmentChecklistFacts } from "@/lib/seller/consignment-checklist-facts";
import { buildConsignmentDetailVm } from "@/lib/seller/consignment-detail.vm";
import { consignmentNextStep } from "@/lib/seller/consignment-next";
import { consignmentAgreementHref } from "@/lib/seller/consignment-records";
import { CONSIGNMENT_STATUS, consignmentStatus } from "@/lib/seller/consignment-status";
import { consignmentWithdrawalViewModel } from "@/lib/seller/consignment-withdrawal-view";
import { loadSellerAccountFacts } from "@/lib/seller/seller-account-facts.server";
import { unsoldChoiceViewModel } from "@/lib/seller/unsold-choice-view";
import { lotPath } from "@/lib/seo/url";
import { computeConsignmentChecklist, evaluateSubmissionQuality } from "@auction/domain";
import { Notice, StatusBadge } from "@auction/ui/lax";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function SubmissionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; submitted?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const actionError = sp.error ? decodeURIComponent(sp.error) : null;
  const user = await requireAuthenticatedUser({
    shell: "client",
    loginNext: `/selling/consignments/${id}`,
  });
  const sellerCtx = await resolveSellerWorkspaceContext(user.role, user.staffRoles);
  const { sellerEntityId, sellingAsOrganisation } = sellerCtx;
  // A person's consignments sit under Selling; an organisation's under Consignments.
  const backLabel = sellingAsOrganisation ? "Consignments" : "Selling";
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
      "We couldn't load this consignment.",
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
      <DashboardPage className="space-y-8">
        <SetMobileShellTitle title="Consignment" />
        <Link
          href={DASHBOARD_ROUTES.consignments}
          className="inline-flex w-fit items-center gap-1 font-body text-sm text-on-surface-variant underline-offset-4 hover:text-on-surface hover:underline"
        >
          <ChevronLeft aria-hidden className="size-4" />
          {backLabel}
        </Link>
        <AccountLoadError {...ACCOUNT_LOAD_ERROR.consignment} />
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

  // What this person may do here: the submission's state and the submission policy, as the API.
  const actions = consignmentActionsVm({
    actor: sellerCtx.actor ? { userId: user.id, member: sellerCtx.actor } : null,
    submission,
  });
  const editable = actions.canEdit;
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
  // A consignor takes back their own uncatalogued submission themselves; the panel's withdrawal
  // binds the organisation and stays with owners and admins, so it would only refuse them.
  const withdrawOwnSubmission =
    actions.canWithdraw &&
    withdrawalView?.mode === "available" &&
    withdrawalView.blockedReason !== null;
  const submissionFormValues = itemSubmissionToFormValues(submission);
  const submissionQuality = evaluateSubmissionQuality(submission);
  const readyToSubmit = editable && submissionQuality.canSubmit;
  const wizardInitialStepIndex = readyToSubmit
    ? wizardStepIndex("review")
    : firstIncompleteWizardStepIndex(submissionFormValues);
  const detail = buildConsignmentDetailVm({
    submission,
    lot: convertedLot,
    agreementAccepted: Boolean(agreementView?.agreement?.acceptedAt),
    listingHref: submission.convertedLotId
      ? lotPath({ id: submission.convertedLotId, title: submission.title })
      : null,
  });
  const photos = submission.images.filter((src): src is string => Boolean(src));
  const agreement = agreementView?.agreement ?? null;
  const unsoldChoiceMade = Boolean(afterSale?.unsold?.choice?.requestedChoice);
  const status = consignmentStatus({
    submission: submission.status,
    agreement: !agreement ? "none" : agreement.acceptedAt ? "accepted" : "open",
    lot: convertedLot
      ? {
          status: convertedLot.status,
          sold: Boolean(convertedLot.winnerId ?? convertedLot.hasWinner),
        }
      : null,
    unsoldChoice: afterSale?.unsold ? (unsoldChoiceMade ? "made" : "none") : null,
  });
  const statusView = CONSIGNMENT_STATUS[status];
  const now = new Date();
  const chooseBy =
    afterSale?.unsold?.chooseBy && !unsoldChoiceMade
      ? formatLotMoment(new Date(afterSale.unsold.chooseBy), now, { time: false })
      : null;
  const nextStep = consignmentNextStep(status, {
    canAccept: Boolean(agreementView?.canAccept),
    organisation: account?.organisationName ?? null,
    chooseBy,
  });
  const headMeta = [
    detail.meta,
    submission.reference,
    submission.sentBy?.name ? `sent by ${submission.sentBy.name}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <DashboardPage className="space-y-8">
      <SetMobileShellTitle title={submission.title} />
      <ConsignmentDetailHead
        vm={{ ...detail, meta: headMeta }}
        title={submission.title}
        status={
          <StatusBadge tone={statusView.tone} shape={statusView.shape}>
            {statusView.label}
          </StatusBadge>
        }
        backHref={DASHBOARD_ROUTES.consignments}
        backLabel={backLabel}
      />
      {actionError ? (
        <DashboardSliceErrorAlert failure={describeSettingsActionError(actionError)} />
      ) : null}
      {categoriesFailure ? <DashboardSliceErrorAlert failure={categoriesFailure} /> : null}
      {sp.submitted === "1" ? <SubmissionSubmittedNotice submissionId={submission.id} /> : null}
      <SubmissionDetailLiveRefresh status={submission.status} />
      {nextStep ? (
        <Notice tone="info" title="What happens next">
          {nextStep}
        </Notice>
      ) : null}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-6">
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
              deadline={chooseBy}
            />
          ) : null}
          {agreementView?.agreement && account ? (
            <ConsignmentAgreementPanel
              agreement={agreementView.agreement}
              canAccept={agreementView.canAccept}
              accountName={accountName}
              accountKind={account.accountKind}
              conditions={CONDITIONS_OF_BUSINESS_PART_C}
              pdfHref={consignmentAgreementHref(submission.id)}
            />
          ) : null}
          <SubmissionRejectionPanel submission={submission} />
          <SubmissionLotReadyChecklist
            submission={submission}
            lot={convertedLot}
            connectRequired={connectRequired}
          />
          {editable ? (
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
          ) : (
            <section
              aria-labelledby="your-submission-heading"
              className="rounded-xl border border-outline-variant/60 bg-surface-container-lowest p-5"
            >
              <h2
                id="your-submission-heading"
                className="font-headline text-base font-semibold text-on-surface"
              >
                Your description
              </h2>
              <p className="mt-2 whitespace-pre-line font-body text-sm text-on-surface-variant">
                {submission.description?.trim() || "No description was added."}
              </p>
              {submission.status !== "rejected" && submission.reviewNotes ? (
                <div className="mt-4 border-t border-outline-variant/50 pt-4">
                  <h3 className="font-body text-sm font-semibold text-on-surface">
                    Your specialist's notes
                  </h3>
                  <p className="mt-1 font-body text-sm text-on-surface-variant">
                    {submission.reviewNotes}
                  </p>
                </div>
              ) : null}
              {photos.length > 1 ? (
                <ul className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-6" aria-label="Photos">
                  {photos.map((src, index) => (
                    <li
                      key={src}
                      className="relative aspect-square overflow-hidden rounded-md bg-surface-container-high"
                    >
                      <MediaImage
                        src={src}
                        alt={`${submission.title}, photo ${index + 1}`}
                        label="Photo"
                        sizes="96px"
                      />
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="mt-4">
                <SubmissionWorkflowActions
                  submissionId={submission.id}
                  canSubmit={actions.canSubmit}
                  canWithdraw={withdrawOwnSubmission}
                />
              </div>
            </section>
          )}
          <SubmissionSellerDocumentsPanel
            submissionId={submission.id}
            status={submission.status}
            initialDocuments={submissionDocuments}
            loadFailure={documentsFailure}
            canManage={actions.canManageDocuments}
          />
        </div>
        <aside className="flex flex-col gap-4" aria-label="About this consignment">
          <AboutTheWork vm={detail} />
          <AskYourSpecialist />
          {!editable && withdrawalView && !withdrawOwnSubmission ? (
            <ConsignmentWithdrawPanel
              submissionId={submission.id}
              view={withdrawalView}
              terms={partCSection("withdrawal-by-seller")}
            />
          ) : null}
        </aside>
      </div>
    </DashboardPage>
  );
}
