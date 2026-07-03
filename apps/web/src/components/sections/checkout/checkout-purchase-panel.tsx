"use client";

import { BuyerGate, isAdminBuyerBlocked } from "@/components/marketing/admin-cannot-buy-notice";
import { CheckoutLotMobileChrome } from "@/components/sections/checkout/checkout-lot-mobile-chrome";
import {
  formatCheckoutAddressLines,
  useCheckoutPurchaseState,
} from "@/components/sections/checkout/use-checkout-purchase-state";
import { manualReviewQueueEyebrow } from "@/lib/admin/compliance-manual-review";
import { manualReviewReasonCopy } from "@/lib/checkout/checkout-payment-errors";
import {
  formatSettlementsContactLine,
  settlementsEmailDisplay,
  settlementsPhone,
} from "@/lib/checkout/settlements-contact";
import { dashboardSofRequirementsUrl } from "@/lib/dashboard/dashboard-copy";
import type { SessionUser } from "@/lib/data/contracts";
import type { ProfileAddressRow } from "@/lib/data/dto/profile-dtos";
import type { ManualReviewReason, PaymentStatus } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import { Card, CardContent } from "@auction/ui/components/card";
import { Checkbox } from "@auction/ui/components/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@auction/ui/components/form";
import { Separator } from "@auction/ui/components/separator";
import { Plus, ShieldCheck, Truck, VerifiedIcon } from "lucide-react";
import Link from "next/link";

type Props = {
  sessionUser: SessionUser;
  lotId: string;
  lotTitle: string;
  hammer: string;
  buyerPremium: string;
  total: string;
  totalMinor?: number;
  currency?: string;
  premiumPercentLabel: string;
  addresses: unknown[];
  paymentComplete?: boolean;
  openPaymentStatus?: PaymentStatus | null;
  openPaymentManualReviewReason?: ManualReviewReason | null;
  openPaymentCheckoutRail?: "card" | "gb_bank_transfer" | null;
  paymentsLoadFailed?: boolean;
  preflightComplianceGate?: "clear" | "aml_hold" | "source_of_funds_required" | null;
  stripeReturnSuccess?: boolean;
};

function PaymentCompleteBlock() {
  return (
    <output className="block rounded-xl border border-primary/20 bg-primary-container/15 px-6 py-8 text-center shadow-sm sm:px-8 sm:py-10">
      <p className="mb-2 font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
        Payment recorded
      </p>
      <p className="font-headline text-2xl text-on-surface">Thank you, collector.</p>
      <p className="mx-auto mt-4 max-w-md font-body text-sm text-on-surface-variant">
        Your payment is on file. Track fulfilment above and view this lot in your collection.
      </p>
      <Button asChild variant="secondaryOutline" className="mt-6">
        <Link href="/dashboard/portfolio">View collection</Link>
      </Button>
    </output>
  );
}

function PaymentInFlightBlock() {
  return (
    <output
      className="block rounded-xl border border-primary/20 bg-primary-container/15 px-6 py-8 text-center shadow-sm sm:px-8 sm:py-10"
      aria-live="polite"
    >
      <p className="mb-2 font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
        Payment in progress
      </p>
      <p className="font-headline text-2xl text-on-surface">Bank transfer processing</p>
      <p className="mx-auto mt-4 max-w-md font-body text-sm text-on-surface-variant">
        Your UK bank transfer is in flight. This page updates automatically when payment is
        confirmed — no need to pay again.
      </p>
    </output>
  );
}

function PaymentConfirmingBlock({
  lotTitle,
  timedOut,
  onRefresh,
}: {
  lotTitle: string;
  timedOut: boolean;
  onRefresh: () => void;
}) {
  if (timedOut) {
    return (
      <output
        className="block rounded-xl border border-warning/40 bg-warning-container/15 px-6 py-8 text-center shadow-sm sm:px-8 sm:py-10"
        aria-live="polite"
      >
        <p className="mb-2 font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
          Still confirming
        </p>
        <p className="font-headline text-2xl text-on-surface">
          Your payment is taking longer than expected
        </p>
        <p className="mx-auto mt-4 max-w-md font-body text-sm text-on-surface-variant">
          Stripe received your payment for {lotTitle} but confirmation has not arrived yet. This can
          take a few minutes. Refresh to check again, or contact settlements if it persists — please
          do not pay again.
        </p>
        <p className="mt-3 break-all font-body text-sm text-on-surface">
          {formatSettlementsContactLine()}
        </p>
        <Button type="button" variant="secondaryOutline" className="mt-6" onClick={onRefresh}>
          Refresh status
        </Button>
      </output>
    );
  }
  return (
    <output
      className="block rounded-xl border border-primary/20 bg-primary-container/15 px-6 py-8 text-center shadow-sm sm:px-8 sm:py-10"
      aria-live="polite"
    >
      <p className="mb-2 font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
        Confirming payment
      </p>
      <p className="font-headline text-2xl text-on-surface">Thank you — processing your payment</p>
      <p className="mx-auto mt-4 max-w-md font-body text-sm text-on-surface-variant">
        Stripe has received your payment for {lotTitle}. This page updates automatically when
        confirmation is complete — please do not pay again.
      </p>
    </output>
  );
}

function BankTransferInstructionsBlock({ lotTitle }: { lotTitle: string }) {
  return (
    <output
      className="block rounded-xl border border-primary/20 bg-primary-container/15 px-6 py-8 shadow-sm sm:px-8 sm:py-10"
      aria-live="polite"
    >
      <p className="mb-2 font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
        Bank transfer requested
      </p>
      <p className="font-headline text-2xl text-on-surface">
        Send your transfer to complete payment
      </p>
      <p className="mt-4 font-body text-sm leading-relaxed text-on-surface-variant">
        We&apos;ve set up a UK bank transfer for {lotTitle}. Use the account details and unique
        reference shown by Stripe (also sent to your email) to make the transfer from your bank.
        Payment is not complete until the funds arrive — this page updates automatically when they
        do.
      </p>
      <p className="mt-4 break-all font-body text-sm text-on-surface">
        Need the details again? {formatSettlementsContactLine()}
      </p>
    </output>
  );
}

type OrderSummaryProps = {
  hammer: string;
  buyerPremium: string;
  total: string;
  premiumPercentLabel: string;
};

function OrderSummaryCard({ hammer, buyerPremium, total, premiumPercentLabel }: OrderSummaryProps) {
  return (
    <Card className="min-w-0 border border-border-hairline bg-surface-container-low shadow-md lg:sticky lg:top-4 lg:z-10 lg:shadow-lg">
      <CardContent className="p-6 sm:p-8">
        <h2 className="mb-6 font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
          Order summary
        </h2>
        <dl className="min-w-0 space-y-4 font-body text-sm">
          <div className="flex min-w-0 justify-between gap-4">
            <dt className="min-w-0 shrink text-on-surface-variant">Hammer price</dt>
            <dd className="shrink-0 font-headline text-lg tabular-nums text-on-surface">
              {hammer}
            </dd>
          </div>
          <div className="flex min-w-0 justify-between gap-4">
            <dt className="min-w-0 break-words pr-2 text-on-surface-variant">
              Buyer&apos;s premium ({premiumPercentLabel})
            </dt>
            <dd className="shrink-0 font-headline text-lg tabular-nums text-primary">
              {buyerPremium}
            </dd>
          </div>
          <Separator className="bg-outline-variant/10" />
          <div className="flex min-w-0 justify-between gap-4">
            <dt className="min-w-0 text-on-surface-variant">Shipping &amp; logistics</dt>
            <dd className="shrink-0 text-right font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
              Quoted after payment
            </dd>
          </div>
          <p className="font-body text-xs leading-relaxed text-on-surface-variant">
            The total below covers the hammer price and buyer&apos;s premium only. Shipping and
            logistics are quoted and invoiced separately once your lot is released.
          </p>
          <Separator className="bg-outline-variant/15" />
          <div className="flex min-w-0 justify-between gap-4 pt-2">
            <dt className="min-w-0 font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface">
              Total due
            </dt>
            <dd className="shrink-0 font-headline text-2xl tabular-nums text-on-surface">
              {total}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}

function ManualReviewBlock({ reason }: { reason: ManualReviewReason | null }) {
  const compliance = reason === "aml_hold" || reason === "source_of_funds_required";
  return (
    <output className="block rounded-xl border border-border-hairline bg-surface-container-low/80 px-6 py-8 shadow-sm sm:px-8">
      <p className="font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
        {manualReviewQueueEyebrow(reason)}
      </p>
      <p className="mt-3 font-body text-sm leading-relaxed text-on-surface-variant">
        {manualReviewReasonCopy(reason)}
      </p>
      {reason === "source_of_funds_required" ? (
        <>
          <ul className="mt-4 list-disc space-y-1 pl-5 font-body text-sm text-on-surface-variant">
            <li>Bank statements covering the funds used for this purchase</li>
            <li>Proof of sale or liquidation if proceeds funded the bid</li>
            <li>
              Documentation for inheritance, gift, or corporate treasury sources if applicable
            </li>
          </ul>
          <Button className="mt-6" asChild>
            <Link href={dashboardSofRequirementsUrl()}>View requirements &amp; upload</Link>
          </Button>
        </>
      ) : null}
      <p className="mt-4 break-all font-body text-sm text-on-surface">
        {compliance ? "Support: " : "Settlements: "}
        {formatSettlementsContactLine()}
      </p>
    </output>
  );
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
}: Props) {
  const {
    form,
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
    refreshStatus,
    submitCheckout,
    retryStripeRedirect,
    addressesSettingsHref,
  } = useCheckoutPurchaseState({
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

  const orderSummary = (
    <OrderSummaryCard
      hammer={hammer}
      buyerPremium={buyerPremium}
      total={total}
      premiumPercentLabel={premiumPercentLabel}
    />
  );

  if (paymentComplete) {
    return (
      <div id="checkout-complete-purchase" className="scroll-mt-28">
        <PaymentCompleteBlock />
      </div>
    );
  }

  if (bankTransferInstructions) {
    return (
      <div id="checkout-complete-purchase" className="scroll-mt-28 space-y-8">
        {orderSummary}
        <BankTransferInstructionsBlock lotTitle={lotTitle} />
      </div>
    );
  }

  if (awaitingCaptureConfirmation) {
    return (
      <div id="checkout-complete-purchase" className="scroll-mt-28 space-y-8">
        {orderSummary}
        <PaymentConfirmingBlock
          lotTitle={lotTitle}
          timedOut={confirmationTimedOut}
          onRefresh={refreshStatus}
        />
      </div>
    );
  }

  if (paymentsLoadFailed) {
    return (
      <div id="checkout-complete-purchase" className="scroll-mt-28 space-y-8">
        {orderSummary}
        <output className="block rounded-xl border border-warning/40 bg-warning-container/15 px-6 py-6 font-body text-sm text-on-surface">
          We could not confirm whether this lot is already paid. Refresh the page before attempting
          checkout again.
        </output>
      </div>
    );
  }

  if (redirectFailed && pendingCheckoutUrl) {
    return (
      <div id="checkout-complete-purchase" className="scroll-mt-28 space-y-8">
        {orderSummary}
        <output
          className="block rounded-xl border border-primary/20 bg-primary-container/15 px-6 py-8 text-center shadow-sm sm:px-8"
          aria-live="polite"
        >
          <p className="font-headline text-xl text-on-surface">Could not open Stripe checkout</p>
          <p className="mx-auto mt-3 max-w-md font-body text-sm text-on-surface-variant">
            Your browser may have blocked the redirect. Use the button below to continue securely.
          </p>
          <Button type="button" className="mt-6" onClick={retryStripeRedirect}>
            Open Stripe checkout
          </Button>
        </output>
      </div>
    );
  }

  if (redirectingToStripe) {
    return (
      <div id="checkout-complete-purchase" className="scroll-mt-28">
        <output
          className="block rounded-xl border border-primary/20 bg-primary-container/15 px-6 py-8 text-center shadow-sm sm:px-8 sm:py-10"
          aria-live="polite"
        >
          <p className="mb-2 font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
            Secure checkout
          </p>
          <p className="font-headline text-2xl text-on-surface">Opening Stripe checkout…</p>
          <p className="mx-auto mt-4 max-w-md font-body text-sm text-on-surface-variant">
            Taking you to pay for {lotTitle}. This may take a few seconds.
          </p>
        </output>
      </div>
    );
  }

  return (
    <div id="checkout-complete-purchase" className="scroll-mt-28 space-y-8">
      {orderSummary}

      {showManualReview ? <ManualReviewBlock reason={showManualReview} /> : null}

      {openPaymentStatus === "authorized" && !showManualReview ? <PaymentInFlightBlock /> : null}

      {!showManualReview && openPaymentStatus !== "authorized" ? (
        <>
          <Card className="min-w-0 border border-border-hairline bg-surface-container-high/40 shadow-sm">
            <CardContent className="p-6 sm:p-8">
              <h2 className="mb-4 font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
                Payment
              </h2>
              <p className="mb-6 font-body text-sm leading-relaxed text-on-surface-variant">
                {openPaymentCheckoutRail === "gb_bank_transfer"
                  ? "This purchase settles by UK bank transfer via secure Stripe Checkout — card is not available above our card limit. High-value purchases may require finance review before checkout is issued."
                  : openPaymentCheckoutRail === "card"
                    ? "Pay by card via secure Stripe Checkout."
                    : "Pay by card or UK bank transfer via secure Stripe Checkout, depending on the amount. High-value purchases may require finance review before checkout is issued."}
              </p>
              <p className="font-body text-sm text-on-surface">
                <span className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
                  Concierge
                </span>
                <br />
                <span className="break-all">{settlementsEmailDisplay()}</span>
                {settlementsPhone() ? (
                  <>
                    <br />
                    <span className="text-on-surface-variant">{settlementsPhone()}</span>
                  </>
                ) : null}
              </p>
            </CardContent>
          </Card>

          <ul className="flex min-w-0 flex-col gap-3 border-y border-border-hairline py-5 font-label text-[10px] font-bold uppercase tracking-[var(--text-label-caps-tracking,0.18em)] text-on-surface-variant sm:flex-row sm:flex-wrap sm:gap-x-6">
            <li className="inline-flex min-w-0 items-center gap-2">
              <ShieldCheck className="size-4 shrink-0 text-primary" aria-hidden />
              <span>Payment protection</span>
            </li>
            <li className="inline-flex min-w-0 items-center gap-2">
              <VerifiedIcon className="size-4 shrink-0 text-primary" aria-hidden />
              <span>Certificate included</span>
            </li>
            <li className="inline-flex min-w-0 items-center gap-2">
              <Truck className="size-4 shrink-0 text-primary" aria-hidden />
              <span>Insured shipping</span>
            </li>
          </ul>

          <BuyerGate user={sessionUser}>
            <Form {...form}>
              <form
                id="checkout-purchase-form"
                className="min-w-0 space-y-6"
                onSubmit={form.handleSubmit(submitCheckout)}
              >
                <FormField
                  control={form.control}
                  name="addressId"
                  render={({ field }) => (
                    <FormItem className="min-w-0">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <FormLabel className="font-label text-xs font-bold uppercase tracking-[0.2em] text-secondary">
                            Shipping / invoice address
                          </FormLabel>
                          {checkoutAddresses.length > 0 ? (
                            <Button
                              type="button"
                              variant="tertiary"
                              size="sm"
                              asChild
                              className="h-auto"
                            >
                              <Link href={addressesSettingsHref} className="inline-flex gap-1">
                                <Plus className="size-3.5" aria-hidden />
                                Add new address
                              </Link>
                            </Button>
                          ) : null}
                        </div>
                        {checkoutAddresses.length === 0 ? (
                          <div className="rounded-lg border border-dashed border-outline-variant/40 p-4">
                            <p className="font-body text-sm text-on-surface-variant">
                              Add an address before checkout so the settlements team can prepare
                              invoice and logistics details.
                            </p>
                            {billingOnlyAddresses.length > 0 ? (
                              <p className="mt-3 break-words font-body text-sm text-on-surface-variant">
                                You only have billing-specific profiles. Update one to include
                                shipping or choose “Billing & shipping” in{" "}
                                <Link href={addressesSettingsHref} className="text-link underline">
                                  addresses
                                </Link>
                                .
                              </p>
                            ) : null}
                            <Button asChild variant="secondary" className="mt-4">
                              <Link href={addressesSettingsHref}>Add address</Link>
                            </Button>
                          </div>
                        ) : (
                          <div
                            className="grid min-w-0 gap-3"
                            role="radiogroup"
                            aria-label="Select shipping or invoice address"
                            onKeyDown={(event) => {
                              const currentIndex = checkoutAddresses.findIndex(
                                (address) => address.id === field.value,
                              );
                              if (currentIndex < 0) return;
                              if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
                              event.preventDefault();
                              const delta = event.key === "ArrowDown" ? 1 : -1;
                              const nextIndex =
                                (currentIndex + delta + checkoutAddresses.length) %
                                checkoutAddresses.length;
                              field.onChange(checkoutAddresses[nextIndex]?.id ?? "");
                            }}
                          >
                            {checkoutAddresses.map((address: ProfileAddressRow) => {
                              const selected = field.value === address.id;
                              return (
                                <Button
                                  key={address.id}
                                  type="button"
                                  variant="ghost"
                                  // biome-ignore lint/a11y/useSemanticElements: address picker uses button radios for keyboard roving tabindex
                                  role="radio"
                                  aria-checked={selected}
                                  tabIndex={selected ? 0 : -1}
                                  onClick={() => field.onChange(address.id)}
                                  className={`h-auto min-h-11 w-full min-w-0 justify-start whitespace-normal rounded-lg border p-4 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                                    selected
                                      ? "border-primary bg-primary-container/10"
                                      : "border-border-hairline bg-surface-container-low/30 hover:border-link/50"
                                  }`}
                                >
                                  <span className="block font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface">
                                    {address.label}
                                    {address.isDefault ? " · Default" : ""}
                                  </span>
                                  <span className="mt-1 block break-words font-body text-sm text-on-surface-variant">
                                    {formatCheckoutAddressLines(address)}
                                  </span>
                                </Button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {billingOnlyAddresses.length > 0 && checkoutAddresses.length > 0 ? (
                  <p className="break-words font-body text-xs text-on-surface-variant" role="note">
                    Separate billing addresses remain on file for invoicing. The selection above
                    covers shipment and primary invoice delivery unless operations specifies
                    otherwise.
                  </p>
                ) : null}
                {selectedAddress ? (
                  <output className="block break-words font-body text-sm text-on-surface-variant">
                    <span className="font-medium text-on-surface">Shipping to:</span>{" "}
                    {selectedAddress.label}
                    {" — "}
                    {formatCheckoutAddressLines(selectedAddress)}
                  </output>
                ) : null}
                <FormField
                  control={form.control}
                  name="termsAccepted"
                  render={({ field }) => (
                    <FormItem className="flex min-w-0 flex-row items-start gap-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={(v) => field.onChange(v === true)}
                        />
                      </FormControl>
                      <div className="min-w-0 space-y-1 leading-none">
                        <FormLabel className="cursor-pointer font-body text-sm font-normal text-on-surface-variant">
                          I agree to the{" "}
                          <Link
                            href="/terms"
                            className="border-b border-primary/40 text-on-surface hover:border-link"
                          >
                            Conditions of Business
                          </Link>
                          , including buyer&apos;s premium and payment deadlines.
                        </FormLabel>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />
                {form.formState.errors.root ? (
                  <p className="break-words text-sm text-error" role="alert">
                    {form.formState.errors.root.message}
                  </p>
                ) : null}
                <Button
                  type="submit"
                  disabled={form.formState.isSubmitting || !canSubmit}
                  className="hidden h-auto min-h-11 w-full py-5 lg:flex"
                >
                  {form.formState.isSubmitting ? "Processing…" : "Complete purchase"}
                </Button>
              </form>
            </Form>
          </BuyerGate>

          {!isAdminBuyerBlocked(sessionUser) ? (
            <CheckoutLotMobileChrome
              totalLabel={total}
              formId="checkout-purchase-form"
              isSubmitting={form.formState.isSubmitting}
              disabled={!canSubmit}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}
