import { ConsignmentAgreementPanel } from "@/components/dashboard/seller/consignment-agreement-panel";
import { ConsignmentChecklist } from "@/components/dashboard/seller/consignment-checklist";
import {
  AboutTheWork,
  AskYourSpecialist,
} from "@/components/dashboard/seller/consignment-detail-parts";
import { ConsignmentDocumentsTab } from "@/components/dashboard/seller/consignment-documents-tab";
import { ConsignmentHistoryTab } from "@/components/dashboard/seller/consignment-history-tab";
import { ConsignmentThread } from "@/components/dashboard/seller/consignment-messages/consignment-thread";
import { ConsignmentWithdrawPanel } from "@/components/dashboard/seller/consignment-withdraw-panel";
import { SubmissionChangesRequestedPanel } from "@/components/dashboard/seller/submission-changes-requested-panel";
import { UnsoldLotChoicePanel } from "@/components/dashboard/seller/unsold-lot-choice-panel";
import { SubmissionLotReadyChecklist } from "@/components/dashboard/submission-lot-ready-checklist";
import { SubmissionRejectionPanel } from "@/components/dashboard/submission-rejection-panel";
import { SubmissionSellerDocumentsPanel } from "@/components/dashboard/submission-seller-documents-panel";
import { SubmissionWorkflowActions } from "@/components/dashboard/submission-workflow-actions";
import { MediaImage } from "@/components/ui/media-image";
import {
  CONDITIONS_OF_BUSINESS_PART_C,
  partCSection,
} from "@/lib/legal/conditions-of-business-part-c";
import { checklistItemView } from "@/lib/seller/consignment-checklist-copy";
import { agreementHoldLine } from "@/lib/seller/consignment-next";
import {
  consignmentAgreementHref,
  consignmentDocumentsHref,
  consignmentEditHref,
  consignmentMessagesHref,
} from "@/lib/seller/consignment-records";
import { ButtonLink } from "@auction/ui/lax/button-link";
import { Notice } from "@auction/ui/lax/notice";
import Link from "next/link";
import type { ConsignmentPageData } from "./consignment-detail.server";

/** "What happens next": the one line the specialist's state asks of the seller. */
export function ConsignmentNextStepNotice({ vm }: { vm: ConsignmentPageData }) {
  const { nextStep, nextLink, editable, submission } = vm;
  if (!nextStep) return null;
  return (
    <Notice
      tone="info"
      title="What happens next"
      {...(editable && submission.status === "draft"
        ? {
            actions: (
              <ButtonLink href={consignmentEditHref(submission.id)} Link={Link} variant="primary">
                Continue
              </ButtonLink>
            ),
          }
        : {})}
    >
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
  );
}

function MessagesTab({ vm }: { vm: ConsignmentPageData }) {
  return (
    <div className="min-w-0">
      <ConsignmentThread
        submissionId={vm.submission.id}
        thread={vm.thread}
        viewerName={vm.userName}
        retryHref={consignmentMessagesHref(vm.submission.id)}
        now={vm.now}
      />
    </div>
  );
}

function DocumentsTab({ vm }: { vm: ConsignmentPageData }) {
  const { submission, actions } = vm;
  return (
    <div className="min-w-0">
      <ConsignmentDocumentsTab
        view={vm.documentsView}
        failed={vm.soldLotsFailed}
        retryHref={consignmentDocumentsHref(submission.id)}
        sellerDocuments={
          vm.sellerDocumentsShown ? (
            <SubmissionSellerDocumentsPanel
              submissionId={submission.id}
              status={submission.status}
              initialDocuments={vm.submissionDocuments}
              loadFailure={vm.documentsFailure}
              canManage={actions.canManageDocuments}
            />
          ) : null
        }
      />
    </div>
  );
}

function HistoryTab({ vm }: { vm: ConsignmentPageData }) {
  return (
    <div className="min-w-0">
      <ConsignmentHistoryTab
        events={vm.history}
        messagesMissing={vm.thread === null}
        payoutsHidden={vm.sold && !vm.canSeePayouts}
      />
    </div>
  );
}

function YourDescription({ vm }: { vm: ConsignmentPageData }) {
  const { submission, photos, withdrawOwnSubmission, canDeleteDraft } = vm;
  return (
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
          <p className="mt-1 font-body text-sm text-on-surface-variant">{submission.reviewNotes}</p>
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
          // Sending happens in the form at Make changes, never from the record.
          canSubmit={false}
          canWithdraw={withdrawOwnSubmission}
          canDeleteDraft={canDeleteDraft}
        />
      </div>
    </section>
  );
}

function OverviewTab({ vm }: { vm: ConsignmentPageData }) {
  const { submission, checklist, account, acceptHold, organisationName, agreementView } = vm;
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <SubmissionChangesRequestedPanel
        submission={submission}
        sentBy={submission.sentBy?.name ?? null}
        editHref={vm.editable ? consignmentEditHref(submission.id) : null}
      />
      {checklist?.applies && account ? (
        <ConsignmentChecklist
          items={checklist.items.map((item) =>
            checklistItemView(item, {
              accountKind: account.accountKind,
              organisationName: account.organisationName,
              agreementHref: "#agreement",
              agreementHeld: acceptHold ? agreementHoldLine(acceptHold, organisationName) : null,
            }),
          )}
          doneCount={checklist.doneCount}
          totalCount={checklist.totalCount}
        />
      ) : null}
      {vm.unsoldView ? (
        <UnsoldLotChoicePanel
          submissionId={submission.id}
          view={vm.unsoldView}
          current={vm.unsoldCurrent}
          deadline={vm.chooseBy}
        />
      ) : null}
      {agreementView?.agreement && account ? (
        <ConsignmentAgreementPanel
          agreement={agreementView.agreement}
          canAccept={agreementView.canAccept}
          accountName={vm.accountName}
          accountKind={account.accountKind}
          conditions={CONDITIONS_OF_BUSINESS_PART_C}
          pdfHref={consignmentAgreementHref(submission.id)}
          heldReason={acceptHold ? agreementHoldLine(acceptHold, organisationName) : null}
        />
      ) : null}
      <SubmissionRejectionPanel submission={submission} />
      <SubmissionLotReadyChecklist
        submission={submission}
        lot={vm.convertedLot}
        connectRequired={vm.connectRequired}
      />
      <YourDescription vm={vm} />
    </div>
  );
}

/** The tab body beside the aside: messages, documents, history, or the overview stack. */
export function ConsignmentTabBody({ vm }: { vm: ConsignmentPageData }) {
  if (vm.tab === "messages") return <MessagesTab vm={vm} />;
  if (vm.tab === "documents") return <DocumentsTab vm={vm} />;
  if (vm.tab === "history") return <HistoryTab vm={vm} />;
  return <OverviewTab vm={vm} />;
}

export function ConsignmentAside({ vm }: { vm: ConsignmentPageData }) {
  const { submission, thread, withdrawalView } = vm;
  const overview = vm.tab === "overview";
  return (
    <aside className="flex flex-col gap-4" aria-label="About this consignment">
      <AboutTheWork vm={vm.detail} />
      {overview ? (
        <AskYourSpecialist
          messagesHref={consignmentMessagesHref(submission.id)}
          canWrite={thread ? thread.access.canWrite : null}
        />
      ) : null}
      {overview && withdrawalView && !vm.withdrawOwnSubmission ? (
        <ConsignmentWithdrawPanel
          submissionId={submission.id}
          view={withdrawalView}
          terms={partCSection("withdrawal-by-seller")}
        />
      ) : null}
    </aside>
  );
}
