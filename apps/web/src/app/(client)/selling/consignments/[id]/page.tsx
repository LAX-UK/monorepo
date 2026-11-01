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
import { ConsignmentDetailTabs } from "@/components/dashboard/seller/consignment-detail-tabs";
import { ConsignmentDocumentsTab } from "@/components/dashboard/seller/consignment-documents-tab";
import { ConsignmentHistoryTab } from "@/components/dashboard/seller/consignment-history-tab";
import { ConsignmentThread } from "@/components/dashboard/seller/consignment-messages/consignment-thread";
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
import { getServerConsignmentThread } from "@/lib/data/http/consignment-messages.server";
import { getServerLotDocuments } from "@/lib/data/http/lot-documents.server";
import { getServerStripeConnectStatus } from "@/lib/data/http/stripe-connect.server";
import { getServerSubmissionDocuments } from "@/lib/data/http/submission-documents.server";
import { listServerSoldLots } from "@/lib/data/http/workspace-selling.server";
import { resolveSaleTitles } from "@/lib/data/sale-titles.server";
import { itemSubmissionToFormValues } from "@/lib/forms/submission/item-submission-form-defaults";
import {
  firstIncompleteWizardStepIndex,
  wizardStepIndex,
} from "@/lib/forms/submission/step-validation";
import { openRecordInItsAccount } from "@/lib/legal-entity/open-record-in-account.server";
import {
  resolveSellerWorkspaceContext,
  sellerCan,
  sellingAccount,
} from "@/lib/legal-entity/seller-acting-context.server";
import {
  CONDITIONS_OF_BUSINESS_PART_C,
  partCSection,
} from "@/lib/legal/conditions-of-business-part-c";
import { consignmentActionsVm } from "@/lib/seller/consignment-actions.vm";
import { checklistItemView } from "@/lib/seller/consignment-checklist-copy";
import { consignmentChecklistFacts } from "@/lib/seller/consignment-checklist-facts";
import {
  consignmentDetailTab,
  consignmentDetailTabItems,
} from "@/lib/seller/consignment-detail-tabs";
import { buildConsignmentDetailVm } from "@/lib/seller/consignment-detail.vm";
import { consignmentDocuments } from "@/lib/seller/consignment-documents";
import { consignmentHistory } from "@/lib/seller/consignment-history";
import {
  agreementHoldLine,
  consignmentNextLink,
  consignmentNextStep,
  withdrawHoldLine,
} from "@/lib/seller/consignment-next";
import {
  consignmentAgreementHref,
  consignmentDocumentsHref,
  consignmentMessagesHref,
} from "@/lib/seller/consignment-records";
import { CONSIGNMENT_STATUS, consignmentStatus } from "@/lib/seller/consignment-status";
import { consignmentWithdrawalViewModel } from "@/lib/seller/consignment-withdrawal-view";
import { loadSellerAccountFacts } from "@/lib/seller/seller-account-facts.server";
import { sellerDocumentsPanelShows } from "@/lib/seller/seller-documents-visibility";
import { unsoldChoiceViewModel } from "@/lib/seller/unsold-choice-view";
import { lotPath } from "@/lib/seo/url";
import {
  computeConsignmentChecklist,
  evaluateSubmissionQuality,
  sellingActionsHold,
} from "@auction/domain";
import { Notice, StatusBadge } from "@auction/ui/lax";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function SubmissionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; submitted?: string; tab?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const tab = consignmentDetailTab(sp.tab);
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

  const [
    submissionRes,
    categoriesRes,
    documentsRes,
    agreementRes,
    accountRes,
    afterSaleRes,
    threadRes,
  ] = await Promise.allSettled([
    c.submissions.getMineById(id),
    c.categories.tree(),
    getServerSubmissionDocuments(id),
    getServerConsignmentAgreement(id),
    loadSellerAccountFacts(sellerCtx),
    getServerConsignmentAfterSale(id),
    getServerConsignmentThread(id),
  ]);
  const thread = threadRes.status === "fulfilled" ? threadRes.value : null;

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
  // The account's state, not only the member's role, decides whether anyone can accept or
  // withdraw now.
  const actingAccount = sellingAccount(sellerCtx);
  const acceptHold = actingAccount ? sellingActionsHold(actingAccount) : null;
  const organisationName = account?.organisationName ?? null;
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
  const withdrawHeld = acceptHold ? withdrawHoldLine(acceptHold, organisationName) : null;
  const withdrawalView = afterSale
    ? consignmentWithdrawalViewModel(afterSale.withdrawal, withdrawHeld)
    : null;
  // A consignor takes back their own uncatalogued submission themselves; the panel's withdrawal
  // binds the organisation and stays with owners and admins, so it would only refuse them. A
  // paused account holds both.
  const withdrawOwnSubmission =
    actions.canWithdraw &&
    !withdrawHeld &&
    afterSale !== null &&
    consignmentWithdrawalViewModel(afterSale.withdrawal).mode === "available" &&
    afterSale.withdrawal.canAct === false;
  const submissionFormValues = itemSubmissionToFormValues(submission);
  const submissionQuality = evaluateSubmissionQuality(submission);
  const readyToSubmit = editable && submissionQuality.canSubmit;
  const wizardInitialStepIndex = readyToSubmit
    ? wizardStepIndex("review")
    : firstIncompleteWizardStepIndex(submissionFormValues);
  const agreement = agreementView?.agreement ?? null;
  // One reading of the agreement for the steps and the status badge, so they always agree.
  const agreementState = !agreement ? "none" : agreement.acceptedAt ? "accepted" : "open";
  const detail = buildConsignmentDetailVm({
    submission,
    lot: convertedLot,
    agreement: agreementState,
    listingHref: submission.convertedLotId
      ? lotPath({ id: submission.convertedLotId, title: submission.title })
      : null,
  });
  const photos = submission.images.filter((src): src is string => Boolean(src));
  const unsoldChoiceMade = Boolean(afterSale?.unsold?.choice?.requestedChoice);
  const status = consignmentStatus({
    submission: submission.status,
    agreement: agreementState,
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
  // Documents and History read the lot's condition reports, the sold lot's payout (for those
  // who see payouts) and the sale's title; each degrades on its own.
  const lotId = submission.convertedLotId;
  const canSeePayouts = sellerCan(sellerCtx, "entity.payouts.read");
  const sold = status === "sold";
  const [lotDocumentsRes, soldLotsRes, saleTitlesRes] = await Promise.allSettled([
    lotId ? getServerLotDocuments(lotId) : Promise.resolve([]),
    sold && canSeePayouts ? listServerSoldLots() : Promise.resolve(null),
    resolveSaleTitles([convertedLot?.saleId ?? null]),
  ]);
  const soldLot =
    soldLotsRes.status === "fulfilled"
      ? (soldLotsRes.value?.items.find((row) => row.lotId === lotId) ?? null)
      : null;
  const nextContext = {
    canAccept: Boolean(agreementView?.canAccept),
    organisation: organisationName,
    chooseBy,
    acceptHold,
    sold: soldLot,
  };
  const nextStep = consignmentNextStep(status, nextContext);
  const nextLink = consignmentNextLink(status, nextContext);
  const documentsView = consignmentDocuments({
    submissionId: submission.id,
    sellerEntityId,
    agreement,
    lotDocuments: lotDocumentsRes.status === "fulfilled" ? lotDocumentsRes.value : [],
    payout: soldLot?.payout ?? null,
    sold,
    canSeePayouts,
  });
  const documentsCount = documentsView.fromLax.length + submissionDocuments.length;
  const sellerDocumentsShown = sellerDocumentsPanelShows({
    status: submission.status,
    canManage: actions.canManageDocuments,
    failed: Boolean(documentsFailure),
    count: submissionDocuments.length,
  });
  const saleTitle =
    convertedLot?.saleId && saleTitlesRes.status === "fulfilled"
      ? (saleTitlesRes.value[convertedLot.saleId] ?? null)
      : null;
  const history =
    tab === "history"
      ? consignmentHistory({
          submission,
          agreement,
          lot: convertedLot
            ? {
                status: convertedLot.status,
                createdAt: convertedLot.createdAt,
                startTime: convertedLot.startTime,
                endTime: convertedLot.endTime,
                sold,
                saleTitle,
              }
            : null,
          unsoldChoice: afterSale?.unsold?.choice ?? null,
          withdrawal: afterSale?.withdrawal.request ?? null,
          messages: thread?.messages ?? null,
          paidOutAt: soldLot?.payout?.settledAt ?? null,
          now,
        })
      : [];
  const headFacts = [
    detail.meta,
    submission.reference,
    submission.sentBy?.name ? `sent by ${submission.sentBy.name}` : null,
  ].filter((fact): fact is string => Boolean(fact));

  return (
    <DashboardPage className="space-y-8">
      <SetMobileShellTitle title={submission.title} />
      <ConsignmentDetailHead
        vm={detail}
        facts={headFacts}
        title={submission.title}
        status={
          <StatusBadge tone={statusView.tone} shape={statusView.shape}>
            {statusView.label}
          </StatusBadge>
        }
      />
      {actionError ? (
        <DashboardSliceErrorAlert failure={describeSettingsActionError(actionError)} />
      ) : null}
      {categoriesFailure ? <DashboardSliceErrorAlert failure={categoriesFailure} /> : null}
      {sp.submitted === "1" ? <SubmissionSubmittedNotice submissionId={submission.id} /> : null}
      {tab === "overview" ? <SubmissionDetailLiveRefresh status={submission.status} /> : null}
      {nextStep ? (
        <Notice tone="info" title="What happens next">
          {nextStep}
          {nextLink ? (
            <>
              {" "}
              <Link href={nextLink.href} className="font-semibold underline underline-offset-4">
                {nextLink.label}
              </Link>
            </>
          ) : null}
        </Notice>
      ) : null}
      <ConsignmentDetailTabs
        activeId={tab}
        items={consignmentDetailTabItems({
          submissionId: submission.id,
          // Unread counts in ink only for the people who answer; others see how many there are.
          messages: thread
            ? {
                total: thread.messages.length,
                unread: thread.access.canWrite ? thread.unread : 0,
              }
            : null,
          documents: documentsCount,
        })}
      />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {tab === "messages" ? (
          <div className="min-w-0">
            <ConsignmentThread
              submissionId={submission.id}
              thread={thread}
              viewerName={user.name}
              retryHref={consignmentMessagesHref(submission.id)}
              now={now}
            />
          </div>
        ) : tab === "documents" ? (
          <div className="min-w-0">
            <ConsignmentDocumentsTab
              view={documentsView}
              failed={soldLotsRes.status === "rejected"}
              retryHref={consignmentDocumentsHref(submission.id)}
              sellerDocuments={
                sellerDocumentsShown ? (
                  <SubmissionSellerDocumentsPanel
                    submissionId={submission.id}
                    status={submission.status}
                    initialDocuments={submissionDocuments}
                    loadFailure={documentsFailure}
                    canManage={actions.canManageDocuments}
                  />
                ) : null
              }
            />
          </div>
        ) : tab === "history" ? (
          <div className="min-w-0">
            <ConsignmentHistoryTab
              events={history}
              messagesMissing={thread === null}
              payoutsHidden={sold && !canSeePayouts}
            />
          </div>
        ) : (
          <div className="flex min-w-0 flex-col gap-6">
            <SubmissionChangesRequestedPanel submission={submission} />
            {checklist?.applies && account ? (
              <ConsignmentChecklist
                items={checklist.items.map((item) =>
                  checklistItemView(item, {
                    accountKind: account.accountKind,
                    organisationName: account.organisationName,
                    agreementHref: "#agreement",
                    agreementHeld: acceptHold
                      ? agreementHoldLine(acceptHold, organisationName)
                      : null,
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
                heldReason={acceptHold ? agreementHoldLine(acceptHold, organisationName) : null}
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
          </div>
        )}
        <aside className="flex flex-col gap-4" aria-label="About this consignment">
          <AboutTheWork vm={detail} />
          {tab === "overview" ? (
            <AskYourSpecialist messagesHref={consignmentMessagesHref(submission.id)} />
          ) : null}
          {tab === "overview" && !editable && withdrawalView && !withdrawOwnSubmission ? (
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
