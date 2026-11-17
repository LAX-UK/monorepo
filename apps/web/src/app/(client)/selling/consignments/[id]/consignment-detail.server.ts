import "server-only";

import { describeDashboardSliceFailure } from "@/lib/dashboard/dashboard-fetch-errors";
import { getServerDataContainer } from "@/lib/data/container.server";
import { getServerConsignmentAfterSale } from "@/lib/data/http/consignment-after-sale.server";
import { getServerConsignmentAgreement } from "@/lib/data/http/consignment-agreements.server";
import { getServerConsignmentThread } from "@/lib/data/http/consignment-messages.server";
import { getServerLotDocuments } from "@/lib/data/http/lot-documents.server";
import { getServerStripeConnectStatus } from "@/lib/data/http/stripe-connect.server";
import { getServerSubmissionDocuments } from "@/lib/data/http/submission-documents.server";
import { listServerSoldLots } from "@/lib/data/http/workspace-selling.server";
import { resolveSaleTitles } from "@/lib/data/sale-titles.server";
import { openRecordInItsAccount } from "@/lib/legal-entity/open-record-in-account.server";
import {
  type resolveSellerWorkspaceContext,
  sellerCan,
  sellingAccount,
} from "@/lib/legal-entity/seller-acting-context.server";
import { consignmentActionsVm } from "@/lib/seller/consignment-actions.vm";
import { consignmentChecklistFacts } from "@/lib/seller/consignment-checklist-facts";
import type { consignmentDetailTab } from "@/lib/seller/consignment-detail-tabs";
import { buildConsignmentDetailVm } from "@/lib/seller/consignment-detail.vm";
import { consignmentDocuments } from "@/lib/seller/consignment-documents";
import { consignmentHistory } from "@/lib/seller/consignment-history";
import { consignmentNextLink, consignmentNextStep } from "@/lib/seller/consignment-next";
import { CONSIGNMENT_STATUS, consignmentStatus } from "@/lib/seller/consignment-status";
import { consignmentWithdrawalViewModel } from "@/lib/seller/consignment-withdrawal-view";
import { loadSellerAccountFacts } from "@/lib/seller/seller-account-facts.server";
import { sellerDocumentsPanelShows } from "@/lib/seller/seller-documents-visibility";
import { unsoldChoiceViewModel } from "@/lib/seller/unsold-choice-view";
import { lotPath } from "@/lib/seo/url";
import { LONDON_TIME_ZONE, formatMoment } from "@auction/datetime";
import { agreementAcceptanceHold, computeConsignmentChecklist } from "@auction/domain";

type SellerCtx = Awaited<ReturnType<typeof resolveSellerWorkspaceContext>>;

/**
 * Everything the consignment detail page shows, read once: the submission and its account, the
 * agreement, the lot and the status that follows from them. The page only chooses what to render.
 */
export async function loadConsignmentDetail(input: {
  id: string;
  tab: ReturnType<typeof consignmentDetailTab>;
  user: { id: string; name: string };
  sellerCtx: SellerCtx;
}) {
  const { id, tab, user, sellerCtx } = input;
  const { sellerEntityId } = sellerCtx;
  const c = await getServerDataContainer();

  let s: Awaited<ReturnType<typeof c.submissions.getMineById>> = null;
  let loadFailure = null as ReturnType<typeof describeDashboardSliceFailure> | null;

  const [submissionRes, documentsRes, agreementRes, accountRes, afterSaleRes, threadRes] =
    await Promise.allSettled([
      c.submissions.getMineById(id),
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

  if (!s) {
    // Not in this account: a link to another account's consignment switches to it, or explains
    // there is no access.
    const opened = await openRecordInItsAccount({
      kind: "consignment",
      id,
      actingId: sellerEntityId,
      next: `/selling/consignments/${id}`,
    });
    if (opened.kind === "hop") return { kind: "hop" as const, href: opened.href };
  }
  if (!loadFailure && !s) return { kind: "notFound" as const };

  if (loadFailure) return { kind: "loadFailure" as const };

  if (!s) return { kind: "notFound" as const };

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
  // The account's state, not only the member's role, decides whether anyone can accept now.
  const actingAccount = sellingAccount(sellerCtx);
  const acceptHold = actingAccount ? agreementAcceptanceHold(actingAccount) : null;
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
  const withdrawalView = afterSale ? consignmentWithdrawalViewModel(afterSale.withdrawal) : null;
  // A consignor takes back their own uncatalogued submission themselves; the panel's withdrawal
  // binds the organisation and stays with owners and admins, so it would only refuse them.
  const withdrawOwnSubmission =
    actions.canWithdraw &&
    withdrawalView?.mode === "available" &&
    withdrawalView.blockedReason !== null;
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
      ? formatMoment(new Date(afterSale.unsold.chooseBy), LONDON_TIME_ZONE, now, { time: false })
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
  const nextLink = consignmentNextLink(status, {
    ...nextContext,
    submissionId: submission.id,
  });
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

  return {
    kind: "ready" as const,
    vm: {
      id,
      tab,
      userName: user.name,
      submission,
      detail,
      headFacts,
      statusView,
      status,
      nextStep,
      nextLink,
      editable,
      thread,
      documentsCount,
      documentsView,
      documentsFailure,
      submissionDocuments,
      sellerDocumentsShown,
      actions,
      soldLotsFailed: soldLotsRes.status === "rejected",
      history,
      sold,
      canSeePayouts,
      now,
      checklist,
      account,
      acceptHold,
      organisationName,
      unsoldView,
      unsoldCurrent,
      chooseBy,
      agreementView,
      accountName,
      convertedLot,
      connectRequired,
      photos,
      withdrawOwnSubmission,
      // GAP-53: a draft this person may delete, by the same policy as the API.
      canDeleteDraft: actions.canDeleteDraft,
      withdrawalView,
    },
  };
}

export type ConsignmentPageData = Extract<
  Awaited<ReturnType<typeof loadConsignmentDetail>>,
  { kind: "ready" }
>["vm"];
