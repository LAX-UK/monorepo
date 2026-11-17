"use client";

import { bidIncrementOptions, validateBidAmount } from "@/features/saleroom/lib/bid-entry";
import {
  type ClerkBidLimitRefusal,
  readClerkBidLimitRefusal,
} from "@/features/saleroom/lib/clerk-bid-refusal";
import { CLERK_BID_REFUSAL_COPY } from "@/features/saleroom/lib/clerk-command-copy";
import {
  clerkPlacePaddleBid,
  clerkPlaceTelephoneBid,
} from "@/features/saleroom/lib/clerk-commands.client";
import {
  ClerkRoomRecheckContext,
  settleUnknownOutcome,
} from "@/features/saleroom/lib/clerk-room-recheck";
import {
  type PaddleRegistrationValidator,
  type SaleroomRegisteredPaddle,
  createPaddleRegistrationValidator,
  createPaddleRosterLookup,
} from "@/features/saleroom/lib/paddle-roster-validation";
import type { ClerkBidEntryState } from "@/features/saleroom/types/staff-saleroom.vm";
import type { AdminTelephoneBookingRow } from "@/lib/data/http/admin.server";
import { notify } from "@/lib/ui/notify";
import { useCallback, useContext, useEffect, useMemo, useState, useTransition } from "react";

export type ClerkBidActionResult =
  | { ok: true }
  | { ok: false; error: string; refusal?: ClerkBidLimitRefusal | null };

export type ClerkBidChannel = "paddle" | "telephone";

/** A bid a limit refused, shown by its form until the clerk changes that bid. */
export type ClerkBidLimitRefusalState = {
  channel: ClerkBidChannel;
  refusal: ClerkBidLimitRefusal;
  /** "Paddle 142", or the telephone bidder's name. */
  bidder: string;
  amount: number;
};

export type PlacePaddleBidFn = (input: {
  saleId: string;
  lotId: string;
  paddleNumber: number;
  amount: number;
}) => Promise<ClerkBidActionResult>;

export type PlaceTelephoneBidFn = (input: {
  lotId: string;
  buyerUserId: string;
  buyerLegalEntityId: string;
  amount: number;
  telephoneBookingId: string;
}) => Promise<ClerkBidActionResult>;

type Options<T extends SaleroomRegisteredPaddle = SaleroomRegisteredPaddle> = {
  saleId: string;
  currentLotId: string;
  liveCurrentPrice: string;
  minBidIncrement: string;
  telephoneBookings: AdminTelephoneBookingRow[];
  paddleRoster?: readonly T[];
  validatePaddleRegistration?: PaddleRegistrationValidator;
  placePaddleBid?: PlacePaddleBidFn;
  placeTelephoneBid?: PlaceTelephoneBidFn;
};

const defaultPlacePaddleBid: PlacePaddleBidFn = async (input) => {
  const result = await clerkPlacePaddleBid(input);
  if (!result.ok) {
    return {
      ok: false,
      error: result.error,
      refusal: readClerkBidLimitRefusal(result.meta?.refusal),
    };
  }
  return { ok: true };
};

const defaultPlaceTelephoneBid: PlaceTelephoneBidFn = async (input) => {
  const result = await clerkPlaceTelephoneBid(input);
  if (!result.ok) {
    return {
      ok: false,
      error: result.error,
      refusal: readClerkBidLimitRefusal(result.meta?.refusal),
    };
  }
  return { ok: true };
};

const PADDLE_BID_TOAST = "clerk-paddle-bid";
const TELEPHONE_BID_TOAST = "clerk-telephone-bid";

function clerkPaddleStorageKey(saleId: string) {
  return `saleroom-clerk-paddle:${saleId}`;
}

export function useClerkBidEntry<T extends SaleroomRegisteredPaddle = SaleroomRegisteredPaddle>({
  saleId,
  currentLotId,
  liveCurrentPrice,
  minBidIncrement,
  telephoneBookings,
  paddleRoster = [],
  validatePaddleRegistration: validatePaddleRegistrationOverride,
  placePaddleBid = defaultPlacePaddleBid,
  placeTelephoneBid = defaultPlaceTelephoneBid,
}: Options<T>) {
  const [state, setState] = useState<ClerkBidEntryState>({
    paddleNumber: "",
    paddleAmount: "",
    telephoneAmount: "",
    bookingId: "",
  });
  const [pending, startTransition] = useTransition();
  const [limitRefusal, setLimitRefusal] = useState<ClerkBidLimitRefusalState | null>(null);
  // A limit refusal is a definite answer: nothing was placed. It stays by its form, with the
  // limit and what to do, until the clerk changes that bid, places another or the lot moves on.
  // Clearing it when a bid is placed means a repeat refusal mounts a fresh alert, so screen
  // readers announce it again.
  const clearRefusal = useCallback((channel: ClerkBidChannel) => {
    setLimitRefusal((prev) => (prev?.channel === channel ? null : prev));
  }, []);
  // A bid that fails or goes unanswered may have been placed anyway. It is never resent (the API's
  // idempotency key would replay it in any case) and never reported as placed: the console
  // re-reads the room so the price shown is the server's, then the error is shown.
  const recheckRoom = useContext(ClerkRoomRecheckContext);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(clerkPaddleStorageKey(saleId));
      if (stored) {
        setState((prev) => ({ ...prev, paddleNumber: stored }));
      }
    } catch {
      /* ignore */
    }
  }, [saleId]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset bid fields when the on-block lot changes
  useEffect(() => {
    setState((prev) => ({
      ...prev,
      paddleAmount: "",
      telephoneAmount: "",
      bookingId: "",
    }));
    setLimitRefusal(null);
  }, [currentLotId]);

  const paddleLookup = useMemo(() => createPaddleRosterLookup(paddleRoster), [paddleRoster]);

  const validateRegistration = useMemo((): PaddleRegistrationValidator => {
    if (validatePaddleRegistrationOverride) {
      return validatePaddleRegistrationOverride;
    }
    return createPaddleRegistrationValidator(paddleRoster);
  }, [paddleRoster, validatePaddleRegistrationOverride]);

  const registeredPaddle = useMemo(() => {
    const parsed = Number.parseInt(state.paddleNumber, 10);
    if (!Number.isInteger(parsed)) return null;
    return paddleLookup.findByPaddleNumber(parsed);
  }, [paddleLookup, state.paddleNumber]);

  const paddleRegistrationError = useMemo(() => {
    if (!state.paddleNumber.trim()) return null;
    return validateRegistration(state.paddleNumber);
  }, [state.paddleNumber, validateRegistration]);

  const canPlacePaddleBid =
    !pending &&
    state.paddleNumber.trim() !== "" &&
    state.paddleAmount.trim() !== "" &&
    paddleRegistrationError == null;

  const incrementOptions = useMemo(
    () => bidIncrementOptions(liveCurrentPrice, minBidIncrement),
    [liveCurrentPrice, minBidIncrement],
  );

  const inProgressBookings = useMemo(() => {
    return telephoneBookings.filter((b) => {
      if (b.status !== "in_progress" && b.status !== "confirmed") return false;
      return b.lotIds.length === 0 || b.lotIds.includes(currentLotId);
    });
  }, [telephoneBookings, currentLotId]);

  const selectedBooking = inProgressBookings.find((b) => b.id === state.bookingId) ?? null;

  const canPlaceTelephoneBid =
    !pending &&
    state.bookingId.trim() !== "" &&
    state.telephoneAmount.trim() !== "" &&
    selectedBooking != null;

  const setPaddleNumber = useCallback(
    (value: string) => {
      setState((prev) => ({ ...prev, paddleNumber: value }));
      clearRefusal("paddle");
      try {
        if (value.trim()) {
          sessionStorage.setItem(clerkPaddleStorageKey(saleId), value);
        } else {
          sessionStorage.removeItem(clerkPaddleStorageKey(saleId));
        }
      } catch {
        /* ignore */
      }
    },
    [saleId, clearRefusal],
  );

  const setPaddleAmount = useCallback(
    (value: string) => {
      setState((prev) => ({ ...prev, paddleAmount: value }));
      clearRefusal("paddle");
    },
    [clearRefusal],
  );

  const setTelephoneAmount = useCallback(
    (value: string) => {
      setState((prev) => ({ ...prev, telephoneAmount: value }));
      clearRefusal("telephone");
    },
    [clearRefusal],
  );

  const setBookingId = useCallback(
    (value: string) => {
      setState((prev) => ({ ...prev, bookingId: value }));
      clearRefusal("telephone");
    },
    [clearRefusal],
  );

  const applyIncrement = useCallback(
    (amount: number, channel: ClerkBidChannel) => {
      const formatted = amount.toFixed(2);
      setState((prev) =>
        channel === "paddle"
          ? { ...prev, paddleAmount: formatted }
          : { ...prev, telephoneAmount: formatted },
      );
      clearRefusal(channel);
    },
    [clearRefusal],
  );

  const placePaddleBidHandler = useCallback(() => {
    const registrationError = validateRegistration(state.paddleNumber);
    if (registrationError) {
      notify.error(registrationError);
      return;
    }
    const parsedAmount = Number.parseFloat(state.paddleAmount);
    const amountError = validateBidAmount(parsedAmount, liveCurrentPrice, minBidIncrement);
    if (amountError) {
      notify.error(amountError);
      return;
    }
    const parsedPaddle = Number.parseInt(state.paddleNumber, 10);
    setLimitRefusal(null);
    startTransition(async () => {
      const result = await placePaddleBid({
        saleId,
        lotId: currentLotId,
        paddleNumber: parsedPaddle,
        amount: parsedAmount,
      });
      if (!result.ok) {
        if (result.refusal) {
          setLimitRefusal({
            channel: "paddle",
            refusal: result.refusal,
            bidder: `Paddle ${parsedPaddle}`,
            amount: parsedAmount,
          });
          return;
        }
        await settleUnknownOutcome(recheckRoom, result.error, PADDLE_BID_TOAST);
        return;
      }
      notify.success(`Paddle ${parsedPaddle} bid placed`);
      setState((prev) => ({ ...prev, paddleAmount: "" }));
    });
  }, [
    currentLotId,
    liveCurrentPrice,
    minBidIncrement,
    placePaddleBid,
    recheckRoom,
    saleId,
    state.paddleAmount,
    state.paddleNumber,
    validateRegistration,
  ]);

  const placeTelephoneBidHandler = useCallback(() => {
    if (!selectedBooking) {
      notify.error("Select a telephone booking");
      return;
    }
    const parsedAmount = Number.parseFloat(state.telephoneAmount);
    const amountError = validateBidAmount(parsedAmount, liveCurrentPrice, minBidIncrement);
    if (amountError) {
      notify.error(amountError);
      return;
    }
    setLimitRefusal(null);
    startTransition(async () => {
      const result = await placeTelephoneBid({
        lotId: currentLotId,
        buyerUserId: selectedBooking.userId,
        buyerLegalEntityId: selectedBooking.buyerLegalEntityId,
        amount: parsedAmount,
        telephoneBookingId: selectedBooking.id,
      });
      if (!result.ok) {
        if (result.refusal) {
          setLimitRefusal({
            channel: "telephone",
            refusal: result.refusal,
            bidder: selectedBooking.userName ?? CLERK_BID_REFUSAL_COPY.unnamedTelephoneBidder,
            amount: parsedAmount,
          });
          return;
        }
        await settleUnknownOutcome(recheckRoom, result.error, TELEPHONE_BID_TOAST);
        return;
      }
      notify.success("Telephone bid placed");
      setState((prev) => ({ ...prev, telephoneAmount: "" }));
    });
  }, [
    currentLotId,
    liveCurrentPrice,
    minBidIncrement,
    placeTelephoneBid,
    recheckRoom,
    selectedBooking,
    state.telephoneAmount,
  ]);

  return {
    state,
    pending,
    incrementOptions,
    inProgressBookings,
    selectedBooking,
    registeredPaddle,
    paddleRegistrationError,
    limitRefusal,
    canPlacePaddleBid,
    canPlaceTelephoneBid,
    setPaddleNumber,
    setPaddleAmount,
    setTelephoneAmount,
    setBookingId,
    applyIncrement,
    placePaddleBid: placePaddleBidHandler,
    placeTelephoneBid: placeTelephoneBidHandler,
  };
}
