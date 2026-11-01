"use client";

import { BidGate } from "@/components/bid/bid-gate";
import { useBiddingAccountFreshness } from "@/components/bid/use-bidding-account-freshness";
import { LotBidDialog } from "@/components/lot-page/bid/bid-dialog";
import { BidEntryControls, type BidEntryHrefs } from "@/components/lot-page/bid/bid-entry-controls";
import { LotBidBlocker } from "@/components/lot-page/bid/lot-bid-blocker";
import { useViewerAnnouncements } from "@/components/lot-page/bid/use-viewer-announcements";
import { useAnnounce } from "@/components/lot-page/lot-announcer";
import { useLotPageViewContext } from "@/components/lot-page/lot-page-view-context";
import type { BiddingAccount } from "@/lib/bid/bidding-account";
import { defaultBidPolicies } from "@/lib/bid/policies";
import { notLivePolicy } from "@/lib/bid/policies/not-live.policy";
import type {
  BidPolicy,
  KycBidGateContext,
  SaleRegistrationBidGateContext,
} from "@/lib/bid/policies/types";
import { useLiveConnection } from "@/lib/connection/use-live-connection";
import { useLotBidHistory } from "@/lib/context/lot-bid-history-provider";
import { useLotPorts } from "@/lib/context/lot-ports";
import { useSaleroomLive } from "@/lib/context/saleroom-live-provider";
import type { SessionUser } from "@/lib/data/contracts";
import { createBidSubmitter } from "@/lib/lot-page/bid-dialog/bid-submitter";
import type { PlacedBidResult } from "@/lib/lot-page/bid-dialog/use-bid-dialog";
import { formatLotMoney } from "@/lib/lot-page/lot-money";
import { lotPageKeys } from "@/lib/lot-page/use-lot-reads";
import { notify } from "@/lib/ui/notify";
import {
  type BidMode,
  type BuyersPremiumTerms,
  type ResolvedLotAction,
  bidModesFor,
  bidPlacedAnnouncement,
  bidSummary,
  buildBidEntry,
  lotLifecycleCopy,
} from "@auction/domain";
import type { Lot, PublicLotView } from "@auction/types";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useRef, useState } from "react";

/** Who is looking and what the bid policies need to decide whether they may bid. */
export type LotBidEntryGate = {
  sessionUser: SessionUser | null;
  loginNextPath: string;
  isOwnLot: boolean;
  actingLegalEntityId: string | null;
  biddingAccount: BiddingAccount | null;
  kycBidGate: KycBidGateContext | null;
  saleRegistrationBidGate: SaleRegistrationBidGateContext | null;
  strictBidEligibilityEnabled: boolean;
  orgModuleEnabled: boolean;
  /** The sale's page, where registering for it happens. */
  saleRegistrationPath: string | null;
  /** Self-service bidding is limited to English and buy-now lots. */
  unsupportedAuctionMode: boolean;
};

export type LotBidEntryProps = {
  auction: Lot | PublicLotView;
  artistName: string | null;
  gate: LotBidEntryGate;
  buyersPremium: BuyersPremiumTerms | null;
};

/** The actions where the bid policies (account, identity, the lot's own state) still decide. */
const POLICY_GATED: ReadonlySet<ResolvedLotAction> = new Set([
  "bid",
  "bid_and_watch_saleroom",
  "set_maximum",
]);

/** A maximum can be left before a lot opens, so "not open yet" doesn't block that action. */
const POLICIES_FOR_MAXIMUM: readonly BidPolicy[] = defaultBidPolicies.filter(
  (policy) => policy !== notLivePolicy,
);

function hrefsOf(gate: LotBidEntryGate): BidEntryHrefs {
  return {
    sign_in: `/login?next=${encodeURIComponent(gate.loginNextPath)}`,
    register: gate.saleRegistrationPath ?? gate.loginNextPath,
    client_services: "/contact",
    ask_admin: "/organisations",
  };
}

/**
 * The bid area of the price block: what to press for the viewer's standing, the policies that may
 * stop them with a reason, and the one dialog where bidding happens. Everything it says comes
 * from the domain; it wires the live lot, the ports and the page's announcements to it.
 */
export function LotBidEntry({ auction: lot, artistName, gate, buyersPremium }: LotBidEntryProps) {
  const { view, currentPrice, nextBid, viewer } = useLotPageViewContext();
  const { bidWriter, absenteeBidWriter } = useLotPorts();
  const { applyOwnBid } = useLotBidHistory();
  const { biddingAllowed } = useLiveConnection();
  const saleroom = useSaleroomLive();
  const announce = useAnnounce();
  const queryClient = useQueryClient();
  const entryRef = useRef<HTMLDivElement | null>(null);
  const [dialog, setDialog] = useState({ open: false, session: 0, start: "next" as BidMode });
  useBiddingAccountFreshness(gate.sessionUser ? gate.actingLegalEntityId : null);
  useViewerAnnouncements({
    position: viewer.position,
    lotTitle: lot.title,
    currentPrice,
    nextBid,
  });

  const submitter = useMemo(
    () => createBidSubmitter({ bidWriter, absenteeBidWriter }),
    [bidWriter, absenteeBidWriter],
  );
  const format = useMemo(() => ({ money: (amount: string) => formatLotMoney(amount) }), []);
  const copy = lotLifecycleCopy(view.lifecycle);
  const scheduled = view.lifecycle === "scheduled";
  const biddingLive = copy.biddingOpen && !scheduled;

  const livePricedLot = useMemo(
    () => ({
      id: lot.id,
      auctionType: lot.auctionType,
      currentPrice,
      startingPrice: lot.startingPrice,
      minBidIncrement: lot.minBidIncrement,
    }),
    [lot.id, lot.auctionType, lot.startingPrice, lot.minBidIncrement, currentPrice],
  );
  const modes = useMemo(
    () => bidModesFor({ lifecycle: view.lifecycle, auctionType: lot.auctionType }),
    [view.lifecycle, lot.auctionType],
  );

  const entry = buildBidEntry({
    action: view.action,
    lifecycle: view.lifecycle,
    auctionType: lot.auctionType,
    position: viewer.position,
    nextBid,
    agentLimitLeft: viewer.agentLimitLeft,
    premiumPercent:
      buyersPremium && nextBid ? bidSummary(buyersPremium, nextBid).percentLabel : null,
    format,
  });

  const onPlaced = useCallback(
    (result: PlacedBidResult) => {
      const { bid } = result;
      if (bid) {
        applyOwnBid({
          id: bid.id,
          amount: bid.amount,
          bidderId: bid.bidderId ?? null,
          placedByUserId: bid.placedByUserId ?? null,
          ...(result.mode === "maximum" ? { isAutoBid: true } : {}),
          placedVia: "web",
        });
      }
      void queryClient.invalidateQueries({ queryKey: lotPageKeys.viewer(lot.id) });
      const message = bidPlacedAnnouncement({ mode: result.mode, amount: result.amount, format });
      announce(message);
      notify.success(message);
      setDialog((current) => ({ ...current, open: false }));
    },
    [applyOwnBid, announce, format, lot.id, queryClient],
  );

  const open = useCallback((start: BidMode) => {
    setDialog((current) => ({ open: true, session: current.session + 1, start }));
  }, []);

  return (
    <div ref={entryRef} id="lot-bid-entry" tabIndex={-1} className="scroll-mt-28 outline-none">
      <BidGate
        user={gate.sessionUser}
        lot={lot}
        lotStatus={lot.status}
        loginNextPath={gate.loginNextPath}
        isOwnLot={gate.isOwnLot}
        actingLegalEntityId={gate.actingLegalEntityId}
        biddingAccount={gate.biddingAccount}
        {...(nextBid ? { minNextBid: Number.parseFloat(nextBid) } : {})}
        kycBidGate={gate.kycBidGate}
        saleRegistrationBidGate={gate.saleRegistrationBidGate}
        strictBidEligibilityEnabled={gate.strictBidEligibilityEnabled}
        biddingLifecycle={{
          kind: view.lifecycle,
          isOnBlock: saleroom?.isLotOnBlock(lot.id) ?? false,
        }}
        orgModuleEnabled={gate.orgModuleEnabled}
        unsupportedAuctionMode={gate.unsupportedAuctionMode}
        connectionBlocked={biddingLive && !biddingAllowed}
        policies={view.action === "set_maximum" ? POLICIES_FOR_MAXIMUM : defaultBidPolicies}
      >
        {({ decision }) =>
          POLICY_GATED.has(view.action) && decision.kind === "block" ? (
            <LotBidBlocker presentation={decision.presentation} />
          ) : (
            <BidEntryControls entry={entry} hrefs={hrefsOf(gate)} onOpen={open} />
          )
        }
      </BidGate>
      {nextBid ? (
        <LotBidDialog
          open={dialog.open}
          session={dialog.session}
          start={dialog.start}
          onOpenChange={(next) => setDialog((current) => ({ ...current, open: next }))}
          onPlaced={onPlaced}
          registerHref={gate.saleRegistrationPath}
          returnFocusFallback={() => entryRef.current}
          modes={modes}
          lot={livePricedLot}
          display={{
            lotNumber: lot.lotNumber,
            title: lot.title,
            artistName,
          }}
          terms={buyersPremium}
          agentLimitLeft={viewer.agentLimitLeft}
          accountName={
            gate.biddingAccount?.kind === "organisation" ? gate.biddingAccount.name : null
          }
          scheduled={scheduled}
          legalEntityId={gate.actingLegalEntityId}
          submitter={submitter}
          format={format}
        />
      ) : null}
    </div>
  );
}
