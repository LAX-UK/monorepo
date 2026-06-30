"use client";

import { isAwaitingCaptureConfirmation } from "@/lib/checkout/checkout-page-state";
import type { PaymentStatus } from "@auction/types";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type UseCheckoutPurchaseStateParams = {
  stripeReturnSuccess: boolean;
  paymentComplete: boolean;
  openPaymentStatus?: PaymentStatus | null;
  openPaymentCheckoutRail?: "card" | "gb_bank_transfer" | null;
};

export function useCheckoutPurchaseState({
  stripeReturnSuccess,
  paymentComplete,
  openPaymentStatus = null,
  openPaymentCheckoutRail = null,
}: UseCheckoutPurchaseStateParams) {
  const router = useRouter();

  const awaitingCaptureConfirmation = isAwaitingCaptureConfirmation({
    stripeReturnSuccess,
    paymentComplete,
    openPaymentStatus,
    openPaymentCheckoutRail,
  });

  const bankTransferInstructions =
    stripeReturnSuccess &&
    !paymentComplete &&
    openPaymentCheckoutRail === "gb_bank_transfer" &&
    openPaymentStatus === "pending";

  const [confirmationTimedOut, setConfirmationTimedOut] = useState(false);

  useEffect(() => {
    if (!awaitingCaptureConfirmation) {
      setConfirmationTimedOut(false);
      return;
    }
    // Cap the poll so a lost/delayed webhook can't refresh the tab forever.
    const deadline = Date.now() + 3 * 60 * 1000;
    const id = window.setInterval(() => {
      if (Date.now() > deadline) {
        setConfirmationTimedOut(true);
        window.clearInterval(id);
        return;
      }
      if (!document.hidden) router.refresh();
    }, 8000);
    return () => window.clearInterval(id);
  }, [awaitingCaptureConfirmation, router]);

  return {
    awaitingCaptureConfirmation,
    bankTransferInstructions,
    confirmationTimedOut,
    refreshStatus: () => router.refresh(),
  };
}
