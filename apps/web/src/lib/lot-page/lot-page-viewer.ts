import type { BiddingAccount } from "@/lib/bid/bidding-account";
import type { KycBidGateContext, SaleRegistrationBidGateContext } from "@/lib/bid/policies/types";
import { resolveKycBidGate } from "@/lib/bid/resolve-kyc-bid-gate";
import type { LotConditionReportSessionInput } from "@/lib/condition-report/lot-condition-report-session-input";
import type { SessionUser } from "@/lib/data/contracts";
import type { LotPageViewModel } from "@/lib/marketing/lot-page-vm";

/*
 * The part of the lot page that belongs to the person looking at it (CO-7).
 *
 * The lot page is rendered once for everyone, as a signed-out visitor sees it, so it can be
 * cached. Everything below depends on who is looking; the server renders the signed-out values
 * and the browser replaces them with the answer of `GET /api/lots/:id/me` (no-store, private,
 * the caller's own data). Both come from the same view model (`buildLotPageViewModel`), so the
 * rules are the ones the page always had.
 */

/** Whether this browser must first be put in its account, and through which hop. */
export type LotPageRestore = { step: "hop" | "stalled"; href: string };

export type LotPageViewer = {
  isAuthenticated: boolean;
  currentUserId: string | null;
  /** The caller's own session, for the bid gate (signing in, verification, KYC prompts). */
  sessionUser: SessionUser | null;
  canParticipateAsBuyer: boolean;
  watching: boolean;
  watchedLotIds: string[];
  isOwnLot: boolean;
  actingLegalEntityId: string | null;
  actingNeedsRestore: boolean;
  restore: LotPageRestore | null;
  biddingAccount: BiddingAccount | null;
  kycBidGate: KycBidGateContext | null;
  saleRegistrationBidGate: SaleRegistrationBidGateContext | null;
  orgModuleEnabled: boolean;
  conditionReport: LotConditionReportSessionInput;
};

/** The personal fields of a lot page view model. */
export function lotPageViewerFrom(
  vm: LotPageViewModel,
  extras: { restore?: LotPageRestore | null } = {},
): LotPageViewer {
  return {
    isAuthenticated: vm.viewer.isAuthenticated,
    currentUserId: vm.session?.id ?? null,
    sessionUser: vm.session,
    canParticipateAsBuyer: vm.viewer.canParticipateAsBuyer,
    watching: vm.watching,
    watchedLotIds: vm.watchedLotIds,
    isOwnLot: vm.isOwnLot,
    actingLegalEntityId: vm.actingLegalEntityId,
    actingNeedsRestore: Boolean(vm.actingCtx.needsRestore),
    restore: extras.restore ?? null,
    biddingAccount: vm.biddingAccount,
    kycBidGate: resolveKycBidGate({ summary: vm.kycSummary, unavailable: vm.kycUnavailable }),
    saleRegistrationBidGate: vm.saleRegistrationBidGate,
    orgModuleEnabled: vm.orgModuleEnabled,
    conditionReport: vm.conditionReport.session,
  };
}
