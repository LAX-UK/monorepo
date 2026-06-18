"use client";

import { bidIncrementOptions, validateBidAmount } from "@/features/saleroom/lib/bid-entry";
import {
  type PaddleRegistrationValidator,
  type SaleroomRegisteredPaddle,
  createPaddleRegistrationValidator,
  createPaddleRosterLookup,
} from "@/features/saleroom/lib/paddle-roster-validation";
import type { ClerkBidEntryState } from "@/features/saleroom/types/staff-saleroom.vm";
import {
  adminPaddlePlaceBidResultAction,
  adminTelephonePlaceBidResultAction,
} from "@/lib/actions/admin";
import type { AdminTelephoneBookingRow } from "@/lib/data/http/admin.server";
import { notify } from "@/lib/ui/notify";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

export type ClerkBidActionResult = { ok: true } | { ok: false; error: string };

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
  const result = await adminPaddlePlaceBidResultAction(input);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true };
};

const defaultPlaceTelephoneBid: PlaceTelephoneBidFn = async (input) => {
  const result = await adminTelephonePlaceBidResultAction(input);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true };
};

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
    [saleId],
  );

  const setPaddleAmount = useCallback((value: string) => {
    setState((prev) => ({ ...prev, paddleAmount: value }));
  }, []);

  const setTelephoneAmount = useCallback((value: string) => {
    setState((prev) => ({ ...prev, telephoneAmount: value }));
  }, []);

  const setBookingId = useCallback((value: string) => {
    setState((prev) => ({ ...prev, bookingId: value }));
  }, []);

  const applyIncrement = useCallback((amount: number, channel: "paddle" | "telephone") => {
    const formatted = amount.toFixed(2);
    setState((prev) =>
      channel === "paddle"
        ? { ...prev, paddleAmount: formatted }
        : { ...prev, telephoneAmount: formatted },
    );
  }, []);

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
    startTransition(async () => {
      const result = await placePaddleBid({
        saleId,
        lotId: currentLotId,
        paddleNumber: parsedPaddle,
        amount: parsedAmount,
      });
      if (!result.ok) {
        notify.error(result.error);
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
    startTransition(async () => {
      const result = await placeTelephoneBid({
        lotId: currentLotId,
        buyerUserId: selectedBooking.userId,
        buyerLegalEntityId: selectedBooking.buyerLegalEntityId,
        amount: parsedAmount,
        telephoneBookingId: selectedBooking.id,
      });
      if (!result.ok) {
        notify.error(result.error);
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
