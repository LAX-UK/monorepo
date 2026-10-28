import "server-only";
import { DASHBOARD_ROUTES } from "@/lib/dashboard/dashboard-copy";
import {
  type DashboardSliceFailure,
  describeDashboardSliceFailure,
} from "@/lib/dashboard/dashboard-fetch-errors";
import { getServerDataContainer } from "@/lib/data/container.server";
import { listServerConsignmentAgreements } from "@/lib/data/http/consignment-agreements.server";
import {
  type SellerWorkspaceContext,
  sellerCan,
} from "@/lib/legal-entity/seller-acting-context.server";
import { submissionsFailureFromCaught } from "@/lib/legal-entity/submissions-access-errors";
import { organisationHref } from "@/lib/navigation/client-routes";
import {
  type ConsignmentRow,
  buildConsignmentRows,
  visibleConsignedLots,
} from "@/lib/seller/consignments.vm";
import {
  computeConsignmentChecklist,
  consignedLotScope,
  rollupConsignmentChecklists,
} from "@auction/domain";
import type { ConsignmentAgreement, ItemSubmission, Lot } from "@auction/types";
import { consignmentChecklistFacts } from "./consignment-checklist-facts";
import { checklistRollupRows } from "./consignment-checklist-rollup-view";
import { loadSellerAccountFacts } from "./seller-account-facts.server";
import { buildSellerAttentionItems } from "./seller-attention";
import { type NeedsYouVm, buildSellingNeedsYou } from "./selling-needs-you";

/** Each source is read in one page; the list says so when a source fills it. */
export const SELLING_PAGE_LIMIT = 100;

export type SellingOverview = {
  failures: DashboardSliceFailure[];
  /** Neither submissions nor lots could be read. */
  loadedNothing: boolean;
  needsYou: NeedsYouVm | null;
  rows: ConsignmentRow[];
  truncated: boolean;
};

const EMPTY: SellingOverview = {
  failures: [],
  loadedNothing: false,
  needsYou: null,
  rows: [],
  truncated: false,
};

function settle<T>(promise: Promise<T>) {
  return promise.then(
    (value) => ({ ok: true as const, value }),
    (reason: unknown) => ({ ok: false as const, reason }),
  );
}

/** Where payout setup lives for the account being sold as. */
function payoutSetupHref(ctx: SellerWorkspaceContext): string {
  return ctx.sellingAsOrganisation && ctx.sellerEntityId
    ? organisationHref("payouts")
    : DASHBOARD_ROUTES.sellerConnect;
}

/**
 * Selling's read model: the consignments the person may see, newest first, and what needs them
 * ("Needs you": the open checklist items across consignments, then changes asked for, drafts and
 * unsold lots). Read through the existing submission, lot, agreement and account endpoints.
 */
export async function loadSellingOverview(
  ctx: SellerWorkspaceContext,
  viewerUserId: string,
): Promise<SellingOverview> {
  const { sellerEntityId } = ctx;
  if (!sellerEntityId || !sellerCan(ctx, "entity.consignments.read")) return EMPTY;

  const c = await getServerDataContainer();
  const [submissionsResult, lotsResult, agreements, account] = await Promise.all([
    settle(c.submissions.listMine({ limit: SELLING_PAGE_LIMIT, offset: 0 })),
    settle(c.sellerLots.list({ sellerId: sellerEntityId, limit: SELLING_PAGE_LIMIT })),
    listServerConsignmentAgreements().catch((): ConsignmentAgreement[] => []),
    loadSellerAccountFacts(ctx).catch(() => null),
  ]);

  const failures: DashboardSliceFailure[] = [];
  const submissions: ItemSubmission[] = submissionsResult.ok ? submissionsResult.value : [];
  if (!submissionsResult.ok) failures.push(submissionsFailureFromCaught(submissionsResult.reason));
  const lots: Lot[] = lotsResult.ok ? lotsResult.value : [];
  if (!lotsResult.ok) {
    failures.push(
      describeDashboardSliceFailure(lotsResult.reason, "sellerLots", "Could not load your lots."),
    );
  }

  const agreementBySubmission = new Map(agreements.map((a) => [a.submissionId, a]));
  const lotById = new Map(lots.map((lot) => [lot.id, lot]));
  const rollup = account
    ? rollupConsignmentChecklists(
        submissions.map((submission) => ({
          id: submission.id,
          title: submission.title,
          checklist: computeConsignmentChecklist(
            consignmentChecklistFacts({
              submission,
              agreement: agreementBySubmission.get(submission.id) ?? null,
              account,
              lot: submission.convertedLotId
                ? (lotById.get(submission.convertedLotId) ?? null)
                : null,
            }),
          ),
        })),
      )
    : [];
  const covered = new Set(rollup.map((row) => row.id));
  const checklist = account
    ? checklistRollupRows(rollup, {
        accountKind: account.accountKind,
        organisationName: account.organisationName,
      })
    : [];
  const attention = buildSellerAttentionItems({
    submissions,
    lots,
    // The checklist already asks for these when a consignment needs them.
    payoutSetupIncomplete: !covered.has("payouts") && account?.payoutsReady === false,
    identityVerificationNeeded: !covered.has("identity") && account?.identity === "required",
    payoutSetupHref: payoutSetupHref(ctx),
    canOpenPayoutSetup: sellerCan(ctx, "entity.connect.operate"),
    now: new Date(),
  });

  // A consignor sees only the lots made from their own submissions.
  const visibleLots = visibleConsignedLots({
    lots,
    submissions,
    scope: consignedLotScope(ctx.actor),
    viewerUserId,
  });
  const acceptedAgreements = new Set(
    agreements.filter((a) => a.acceptedAt != null).map((a) => a.submissionId),
  );

  return {
    failures,
    loadedNothing: failures.length === 2,
    needsYou: buildSellingNeedsYou({ checklist, attention }),
    rows: buildConsignmentRows({ submissions, lots: visibleLots, acceptedAgreements }),
    truncated: submissions.length >= SELLING_PAGE_LIMIT || lots.length >= SELLING_PAGE_LIMIT,
  };
}
