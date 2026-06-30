"use client";

import type { ProfileAddressRow } from "@/components/dashboard/profile-settings-board";
import {
  type CheckoutPaymentActionData,
  createCheckoutPaymentAction,
} from "@/lib/actions/checkout";
import { trackBeginCheckout } from "@/lib/analytics/events";
import { isAwaitingCaptureConfirmation } from "@/lib/checkout/checkout-page-state";
import {
  checkoutPaymentErrorMessage,
  manualReviewReasonCopy,
  resolveCheckoutManualReviewDisplayReason,
} from "@/lib/checkout/checkout-payment-errors";
import { dashboardCheckoutLotUrl } from "@/lib/dashboard/dashboard-copy";
import { notifyAdminCannotBuyIfNeeded } from "@/lib/ui/admin-cannot-buy";
import { notify } from "@/lib/ui/notify";
import type { ManualReviewReason, PaymentStatus } from "@auction/types";
import {
  type CheckoutTermsAcceptanceValues,
  checkoutTermsAcceptanceSchema,
} from "@auction/validators";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

function parseAddress(raw: unknown): ProfileAddressRow {
  const row = raw as Record<string, unknown>;
  return {
    id: String(row.id ?? ""),
    label: String(row.label ?? ""),
    line1: String(row.line1 ?? ""),
    line2: row.line2 == null ? null : String(row.line2),
    city: String(row.city ?? ""),
    state: row.state == null ? null : String(row.state),
    postalCode: String(row.postalCode ?? ""),
    country: String(row.country ?? ""),
    addressType:
      row.addressType === "shipping" || row.addressType === "billing" || row.addressType === "both"
        ? row.addressType
        : "both",
    isDefault: Boolean(row.isDefault),
  };
}

export function formatCheckoutAddressLines(address: ProfileAddressRow): string {
  const line2 = address.line2 ? `, ${address.line2}` : "";
  return `${address.line1}${line2}, ${address.city}, ${address.postalCode}, ${address.country}`;
}

export function checkoutAddressesSettingsHref(lotId: string): string {
  const next = encodeURIComponent(dashboardCheckoutLotUrl(lotId));
  return `/dashboard/settings/addresses?next=${next}`;
}

type UseCheckoutPurchaseStateParams = {
  lotId: string;
  totalMinor?: number | undefined;
  currency?: string;
  rawAddresses: unknown[];
  paymentComplete: boolean;
  openPaymentStatus?: PaymentStatus | null;
  openPaymentManualReviewReason?: ManualReviewReason | null;
  openPaymentCheckoutRail?: "card" | "gb_bank_transfer" | null;
  preflightComplianceGate?: "clear" | "aml_hold" | "source_of_funds_required" | null;
  stripeReturnSuccess: boolean;
};

export function useCheckoutPurchaseState({
  lotId,
  totalMinor,
  currency = "GBP",
  rawAddresses,
  paymentComplete,
  openPaymentStatus = null,
  openPaymentManualReviewReason = null,
  openPaymentCheckoutRail = null,
  preflightComplianceGate = null,
  stripeReturnSuccess,
}: UseCheckoutPurchaseStateParams) {
  const router = useRouter();
  const [submitted, setSubmitted] = useState(false);
  const [redirectingToStripe, setRedirectingToStripe] = useState(false);
  const [redirectFailed, setRedirectFailed] = useState(false);
  const [pendingCheckoutUrl, setPendingCheckoutUrl] = useState<string | null>(null);
  const [submittedReviewReason, setSubmittedReviewReason] = useState<ManualReviewReason | null>(
    null,
  );

  const addresses = useMemo(() => rawAddresses.map(parseAddress), [rawAddresses]);
  const checkoutAddresses = useMemo(
    () => addresses.filter((a) => a.addressType === "shipping" || a.addressType === "both"),
    [addresses],
  );
  const billingOnlyAddresses = useMemo(
    () => addresses.filter((a) => a.addressType === "billing"),
    [addresses],
  );
  const defaultAddress = useMemo(
    () => checkoutAddresses.find((a) => a.isDefault) ?? checkoutAddresses[0],
    [checkoutAddresses],
  );

  const form = useForm<CheckoutTermsAcceptanceValues>({
    resolver: zodResolver(checkoutTermsAcceptanceSchema),
    defaultValues: { addressId: defaultAddress?.id ?? "", termsAccepted: false },
  });

  const addressId = useWatch({ control: form.control, name: "addressId" });
  const termsAccepted = useWatch({ control: form.control, name: "termsAccepted" });
  const selectedAddress = useMemo(
    () => checkoutAddresses.find((a) => a.id === addressId) ?? null,
    [checkoutAddresses, addressId],
  );
  const canSubmit =
    Boolean(termsAccepted) &&
    Boolean(addressId) &&
    checkoutAddresses.some((address) => address.id === addressId);

  useEffect(() => {
    if (
      totalMinor != null &&
      totalMinor > 0 &&
      !paymentComplete &&
      openPaymentStatus !== "authorized"
    ) {
      trackBeginCheckout({ lotId, valueMinor: totalMinor, currency });
    }
  }, [lotId, totalMinor, currency, paymentComplete, openPaymentStatus]);

  useEffect(() => {
    if (!redirectingToStripe) return;
    const timeout = window.setTimeout(() => {
      setRedirectingToStripe(false);
      setRedirectFailed(true);
    }, 8000);
    return () => window.clearTimeout(timeout);
  }, [redirectingToStripe]);

  const showManualReview = resolveCheckoutManualReviewDisplayReason({
    submitted,
    submittedReviewReason,
    openPaymentStatus,
    openPaymentManualReviewReason,
    preflightComplianceGate,
  });

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

  const handlePaymentResult = useCallback(
    (data: CheckoutPaymentActionData) => {
      if (data.checkoutUrl) {
        setPendingCheckoutUrl(data.checkoutUrl);
        setRedirectFailed(false);
        setRedirectingToStripe(true);
        window.location.assign(data.checkoutUrl);
        return;
      }
      if (data.manualReviewReason) {
        setSubmittedReviewReason(data.manualReviewReason);
        setSubmitted(true);
        notify.success("Payment submitted for review", {
          description: manualReviewReasonCopy(data.manualReviewReason),
        });
        return;
      }
      router.refresh();
    },
    [router],
  );

  const submitCheckout = useCallback(
    async (values: CheckoutTermsAcceptanceValues) => {
      form.clearErrors("root");
      const r = await createCheckoutPaymentAction(lotId, values.addressId);
      if (!r.ok) {
        if (r.status === 401 && r.errorCode === "session_required") {
          const next = encodeURIComponent(dashboardCheckoutLotUrl(lotId));
          window.location.assign(`/login?session_expired=1&next=${next}`);
          return;
        }
        notifyAdminCannotBuyIfNeeded(r.error, r.status ?? 500);
        const msg = r.errorCode ? checkoutPaymentErrorMessage(r.error, r.errorCode) : r.error;
        form.setError("root", { message: msg });
        return;
      }
      if (r.data) handlePaymentResult(r.data);
    },
    [form, handlePaymentResult, lotId],
  );

  const retryStripeRedirect = useCallback(() => {
    if (!pendingCheckoutUrl) return;
    setRedirectFailed(false);
    setRedirectingToStripe(true);
    window.location.assign(pendingCheckoutUrl);
  }, [pendingCheckoutUrl]);

  return {
    form,
    addresses,
    checkoutAddresses,
    billingOnlyAddresses,
    selectedAddress,
    canSubmit,
    showManualReview,
    awaitingCaptureConfirmation,
    bankTransferInstructions,
    confirmationTimedOut,
    redirectingToStripe,
    redirectFailed,
    pendingCheckoutUrl,
    refreshStatus: () => router.refresh(),
    submitCheckout,
    retryStripeRedirect,
    addressesSettingsHref: checkoutAddressesSettingsHref(lotId),
  };
}
