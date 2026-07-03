import type { LotBidPosition } from "@/lib/bid/derive-lot-bid-position";
import { type LotBidEntryMode, defaultLotBidEntryMode } from "@/lib/bid/lot-bid-entry-mode";
import type { AutoBidPlacedBid, AutoBidSettings } from "@/lib/data/contracts";
import type { Lot, PublicLotView } from "@auction/types";
import { useCallback, useEffect, useRef, useState } from "react";

export type UseBidEntryStateParams = {
  auction: Lot | PublicLotView;
  initialAutoBidSettings?: AutoBidSettings | null;
  initialOutbid?: boolean;
  omitPricingHeader?: boolean;
  activeAutoBid: AutoBidSettings | null;
  position: LotBidPosition;
  scrollToBid: () => void;
  scrollToAutoBid: () => void;
  clearConfirmAttempt: () => void;
};

export type UseBidEntryStateResult = {
  amount: string;
  setAmount: (value: string) => void;
  maxAuto: string;
  setMaxAuto: (value: string) => void;
  entryMode: LotBidEntryMode;
  step: 1 | 2;
  setStep: (step: 1 | 2) => void;
  bidSuccess: boolean;
  setBidSuccess: (value: boolean) => void;
  useOnlineBidStepper: boolean;
  switchEntryMode: (mode: LotBidEntryMode, opts?: { userInitiated?: boolean }) => void;
  handleAutoBidDraft: (draft: { maxAuto: string; step: string; dirty: boolean }) => void;
  onAutoBidSaved: (settings: AutoBidSettings | null, placedBid?: AutoBidPlacedBid) => void;
};

export function useBidEntryState({
  auction,
  initialAutoBidSettings = null,
  initialOutbid = false,
  omitPricingHeader = false,
  activeAutoBid,
  position,
  scrollToBid,
  scrollToAutoBid,
  clearConfirmAttempt,
  applyOwnBidResult,
  handleAutoBidSaved,
  minNumeric,
}: UseBidEntryStateParams & {
  applyOwnBidResult: (bid: AutoBidPlacedBid) => void;
  handleAutoBidSaved: (settings: AutoBidSettings | null) => void;
  minNumeric: number;
}): UseBidEntryStateResult {
  const [amount, setAmount] = useState("");
  const [maxAuto, setMaxAuto] = useState(initialAutoBidSettings?.maxAutoBidAmount ?? "");
  const [entryMode, setEntryMode] = useState<LotBidEntryMode>(() =>
    defaultLotBidEntryMode({
      supportsAutoBid: auction.auctionType === "english" || auction.auctionType === "buy_it_now",
      hasActiveAutoBid: Boolean(initialAutoBidSettings?.isActive),
      userPreference: null,
    }),
  );
  const [step, setStep] = useState<1 | 2>(1);
  const [bidSuccess, setBidSuccess] = useState(false);
  const userPickedModeRef = useRef(false);

  const useOnlineBidStepper =
    omitPricingHeader &&
    (auction.auctionType === "english" || auction.auctionType === "buy_it_now");

  useEffect(() => {
    if (!bidSuccess) return;
    const t = window.setTimeout(() => setBidSuccess(false), 4000);
    return () => window.clearTimeout(t);
  }, [bidSuccess]);

  useEffect(() => {
    if (!useOnlineBidStepper) return;
    if (amount.trim() !== "") return;
    setAmount(minNumeric.toFixed(2));
  }, [useOnlineBidStepper, minNumeric, amount]);

  const switchEntryMode = useCallback(
    (mode: LotBidEntryMode, opts?: { userInitiated?: boolean }) => {
      if (opts?.userInitiated) userPickedModeRef.current = true;

      if (step !== 1) {
        clearConfirmAttempt();
        setStep(1);
      }

      if (mode === "manual" && amount.trim() === "") {
        setAmount(minNumeric.toFixed(2));
      }

      setEntryMode(mode);

      requestAnimationFrame(() => {
        if (mode === "auto") scrollToAutoBid();
        else scrollToBid();
      });
    },
    [amount, clearConfirmAttempt, minNumeric, scrollToAutoBid, scrollToBid, step],
  );

  const handleAutoBidDraft = useCallback(
    (draft: { maxAuto: string; step: string; dirty: boolean }) => {
      setMaxAuto(draft.maxAuto);
    },
    [],
  );

  const onAutoBidSaved = useCallback(
    (settings: AutoBidSettings | null, placedBid?: AutoBidPlacedBid) => {
      handleAutoBidSaved(settings);
      if (placedBid) {
        applyOwnBidResult(placedBid);
      }
      if (settings) {
        setMaxAuto(settings.maxAutoBidAmount);
      } else {
        setMaxAuto("");
      }
    },
    [applyOwnBidResult, handleAutoBidSaved],
  );

  const supportsAutoBidPanel =
    auction.auctionType === "english" || auction.auctionType === "buy_it_now";

  useEffect(() => {
    if (!supportsAutoBidPanel) return;
    if (userPickedModeRef.current) return;
    if (initialOutbid) {
      setEntryMode(activeAutoBid?.isActive ? "auto" : "manual");
    }
  }, [activeAutoBid?.isActive, initialOutbid, supportsAutoBidPanel]);

  useEffect(() => {
    if (!supportsAutoBidPanel) return;
    if (userPickedModeRef.current) return;
    if (position.kind === "outbid" || position.kind === "inRunning") {
      setEntryMode(activeAutoBid?.isActive ? "auto" : "manual");
    }
  }, [activeAutoBid?.isActive, position.kind, supportsAutoBidPanel]);

  return {
    amount,
    setAmount,
    maxAuto,
    setMaxAuto,
    entryMode,
    step,
    setStep,
    bidSuccess,
    setBidSuccess,
    useOnlineBidStepper,
    switchEntryMode,
    handleAutoBidDraft,
    onAutoBidSaved,
  };
}
