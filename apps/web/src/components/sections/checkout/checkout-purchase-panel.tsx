"use client";

import { CheckoutPurchaseForm } from "@/components/sections/checkout/checkout-purchase-form";
import type { CheckoutPurchasePanelProps } from "@/components/sections/checkout/checkout-purchase-panel.types";
import { PaymentMethodCard } from "@/components/sections/checkout/payment-method-card";
import { BankTransferInstructionsBlock } from "@/components/sections/checkout/status/bank-transfer-instructions-block";
import { ManualReviewBlock } from "@/components/sections/checkout/status/manual-review-block";
import { OrderSummaryCard } from "@/components/sections/checkout/status/order-summary-card";
import { PaymentCompleteBlock } from "@/components/sections/checkout/status/payment-complete-block";
import { PaymentConfirmingBlock } from "@/components/sections/checkout/status/payment-confirming-block";
import { PaymentInFlightBlock } from "@/components/sections/checkout/status/payment-in-flight-block";
import { PaymentsLoadFailedBlock } from "@/components/sections/checkout/status/payments-load-failed-block";
import { RedirectFailedBlock } from "@/components/sections/checkout/status/redirect-failed-block";
import { RedirectingToStripeBlock } from "@/components/sections/checkout/status/redirecting-to-stripe-block";
import { TrustBadges } from "@/components/sections/checkout/trust-badges";
import { useCheckoutPurchaseState } from "@/components/sections/checkout/use-checkout-purchase-state";
import {
  type CheckoutView,
  checkoutViewShowsOrderSummary,
  resolveCheckoutView,
} from "@/lib/checkout/checkout-page-state";
import type { ReactNode } from "react";

export type { CheckoutPurchasePanelProps } from "@/components/sections/checkout/checkout-purchase-panel.types";

function checkoutPurchaseShell(
  _view: CheckoutView,
  children: ReactNode,
  className = "scroll-mt-28 space-y-8",
) {
  return (
    <div id="checkout-complete-purchase" className={className}>
      {children}
    </div>
  );
}

function assertNever(value: never): never {
  throw new Error(`Unhandled checkout view: ${JSON.stringify(value)}`);
}

export function CheckoutPurchasePanel({
  sessionUser,
  lotId,
  lotTitle,
  hammer,
  buyerPremium,
  total,
  totalMinor,
  currency = "GBP",
  premiumPercentLabel,
  addresses: rawAddresses,
  paymentComplete = false,
  openPaymentStatus = null,
  openPaymentManualReviewReason = null,
  openPaymentCheckoutRail = null,
  paymentsLoadFailed = false,
  preflightComplianceGate = null,
  stripeReturnSuccess = false,
}: CheckoutPurchasePanelProps) {
  const purchaseState = useCheckoutPurchaseState({
    lotId,
    totalMinor,
    currency,
    rawAddresses,
    paymentComplete,
    openPaymentStatus,
    openPaymentManualReviewReason,
    openPaymentCheckoutRail,
    preflightComplianceGate,
    stripeReturnSuccess,
  });

  const view = resolveCheckoutView({
    paymentComplete,
    paymentsLoadFailed,
    bankTransferInstructions: purchaseState.bankTransferInstructions,
    awaitingCaptureConfirmation: purchaseState.awaitingCaptureConfirmation,
    redirectFailed: purchaseState.redirectFailed,
    pendingCheckoutUrl: purchaseState.pendingCheckoutUrl,
    redirectingToStripe: purchaseState.redirectingToStripe,
    showManualReview: purchaseState.showManualReview,
    openPaymentStatus,
  });

  const orderSummary = checkoutViewShowsOrderSummary(view) ? (
    <OrderSummaryCard
      hammer={hammer}
      buyerPremium={buyerPremium}
      total={total}
      premiumPercentLabel={premiumPercentLabel}
    />
  ) : null;

  switch (view.kind) {
    case "complete":
      return checkoutPurchaseShell(view, <PaymentCompleteBlock />, "scroll-mt-28");

    case "bankTransfer":
      return checkoutPurchaseShell(
        view,
        <>
          {orderSummary}
          <BankTransferInstructionsBlock lotTitle={lotTitle} />
        </>,
      );

    case "confirming":
      return checkoutPurchaseShell(
        view,
        <>
          {orderSummary}
          <PaymentConfirmingBlock
            lotTitle={lotTitle}
            timedOut={purchaseState.confirmationTimedOut}
            onRefresh={purchaseState.refreshStatus}
          />
        </>,
      );

    case "loadFailed":
      return checkoutPurchaseShell(
        view,
        <>
          {orderSummary}
          <PaymentsLoadFailedBlock />
        </>,
      );

    case "redirectFailed":
      return checkoutPurchaseShell(
        view,
        <>
          {orderSummary}
          <RedirectFailedBlock onRetry={purchaseState.retryStripeRedirect} />
        </>,
      );

    case "redirecting":
      return checkoutPurchaseShell(
        view,
        <RedirectingToStripeBlock lotTitle={lotTitle} />,
        "scroll-mt-28",
      );

    case "purchase":
      return checkoutPurchaseShell(
        view,
        <>
          {orderSummary}
          {view.sub === "manualReview" ? (
            <ManualReviewBlock reason={view.manualReviewReason} />
          ) : null}
          {view.sub === "inFlight" ? <PaymentInFlightBlock /> : null}
          {view.sub === "form" ? (
            <>
              <PaymentMethodCard checkoutRail={openPaymentCheckoutRail} />
              <TrustBadges />
              <CheckoutPurchaseForm
                sessionUser={sessionUser}
                totalLabel={total}
                form={purchaseState.form}
                checkoutAddresses={purchaseState.checkoutAddresses}
                billingOnlyAddresses={purchaseState.billingOnlyAddresses}
                selectedAddress={purchaseState.selectedAddress}
                canSubmit={purchaseState.canSubmit}
                addressesSettingsHref={purchaseState.addressesSettingsHref}
                submitCheckout={purchaseState.submitCheckout}
              />
            </>
          ) : null}
        </>,
      );

    default:
      return assertNever(view);
  }
}
