"use client";

import { openBidDialog, reduceBidDialog } from "@/lib/lot-page/bid-dialog/bid-dialog-state";
import {
  type BidDialogView,
  type BidDialogViewInput,
  buildBidDialogView,
} from "@/lib/lot-page/bid-dialog/bid-dialog-view";
import type { BidSubmitter } from "@/lib/lot-page/bid-dialog/bid-submitter";
import {
  type BidMode,
  type BuyersPremiumTerms,
  type NextBidLot,
  amountsWithinLimit,
  moneyGte,
  nextBidAmount,
  validBidAmounts,
} from "@auction/domain";
import type { Bid } from "@auction/types";
import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";

/** What a placed bid or maximum tells the page. */
export type PlacedBidResult = {
  mode: BidMode;
  /** The next bid that was placed, or the maximum that was set. */
  amount: string;
  bid: Bid | null;
};

export type UseBidDialogInput = {
  start: BidMode;
  modes: readonly BidMode[];
  /** The lot with its price as it is now; the next bid and the amounts to choose follow it. */
  lot: NextBidLot & { id: string };
  display: BidDialogViewInput["lot"];
  terms: BuyersPremiumTerms | null;
  agentLimitLeft: string | null;
  accountName: string | null;
  scheduled: boolean;
  legalEntityId: string | null;
  submitter: BidSubmitter;
  format: BidDialogViewInput["format"];
  onPlaced: (result: PlacedBidResult) => void;
  newKey?: () => string;
};

export type BidDialogController = {
  view: BidDialogView;
  chooseMode: (mode: BidMode) => void;
  chooseMaximum: (maximum: string) => void;
  applyAmount: (amount: string) => void;
  confirm: () => void;
  mode: BidMode;
  submitting: boolean;
};

/**
 * The bid dialog's behaviour: the choices, the live price moving under the bidder, the
 * confirmation and what happens on each answer. It shows a changed amount to the bidder before
 * anything is sent, and keeps one idempotency key for as long as the bid being sent is unchanged.
 */
export function useBidDialog(input: UseBidDialogInput): BidDialogController {
  const { lot, agentLimitLeft, submitter, onPlaced, newKey = () => crypto.randomUUID() } = input;
  const nextBid = nextBidAmount(lot);
  const liveLadder = useMemo(
    () => amountsWithinLimit(validBidAmounts(lot), agentLimitLeft),
    [lot, agentLimitLeft],
  );
  const [state, dispatch] = useReducer(reduceBidDialog, undefined, () =>
    openBidDialog({ mode: input.start, nextBid, ladder: liveLadder }),
  );

  // The bidder is told when the price moves while they look; it is never changed silently.
  const lastLiveNextBid = useRef(nextBid);
  useEffect(() => {
    if (lastLiveNextBid.current === nextBid) return;
    lastLiveNextBid.current = nextBid;
    dispatch({ type: "price_moved", nextBid, ladder: liveLadder });
  }, [nextBid, liveLadder]);

  // Never offer a maximum below the next bid the bidder is looking at.
  const ladder = useMemo(
    () => liveLadder.filter((amount) => moneyGte(amount, state.shownNextBid)),
    [liveLadder, state.shownNextBid],
  );

  const view = buildBidDialogView({
    state,
    lot: input.display,
    ladder,
    modes: input.modes,
    terms: input.terms,
    agentLimitLeft,
    accountName: input.accountName,
    scheduled: input.scheduled,
    format: input.format,
  });

  const keyRef = useRef<{ attempt: number; key: string } | null>(null);
  const keyFor = useCallback(
    (attempt: number): string => {
      if (keyRef.current?.attempt !== attempt) keyRef.current = { attempt, key: newKey() };
      return keyRef.current.key;
    },
    [newKey],
  );

  const stateRef = useRef(state);
  stateRef.current = state;

  const confirm = useCallback(async () => {
    const current = stateRef.current;
    if (current.phase !== "choosing" || view.confirm.kind === "none") return;
    if (view.confirm.kind === "disabled") return;
    const amount = current.mode === "maximum" ? current.maximum : current.shownNextBid;
    if (amount === null) return;
    dispatch({ type: "submitted" });
    const outcome = await submitter.submit({
      lotId: lot.id,
      mode: current.mode,
      amount: current.shownNextBid,
      maximum: current.mode === "maximum" ? current.maximum : null,
      seenNextBid: current.shownNextBid,
      idempotencyKey: keyFor(current.attempt),
      scheduled: input.scheduled,
      legalEntityId: input.legalEntityId,
    });
    if (outcome.ok) {
      dispatch({ type: "placed" });
      onPlaced({ mode: current.mode, amount, bid: outcome.bid });
      return;
    }
    dispatch({ type: "failed", failure: outcome.failure, ladder });
  }, [
    view.confirm.kind,
    submitter,
    lot.id,
    keyFor,
    input.scheduled,
    input.legalEntityId,
    ladder,
    onPlaced,
  ]);

  return {
    view,
    mode: state.mode,
    submitting: state.phase === "submitting" || state.phase === "placed",
    chooseMode: useCallback((mode) => dispatch({ type: "chose_mode", mode, ladder }), [ladder]),
    chooseMaximum: useCallback((maximum) => dispatch({ type: "chose_maximum", maximum }), []),
    applyAmount: useCallback((amount) => dispatch({ type: "used_amount", amount }), []),
    confirm: () => void confirm(),
  };
}
