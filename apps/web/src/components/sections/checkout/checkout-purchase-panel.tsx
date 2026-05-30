"use client";

import type { ProfileAddressRow } from "@/components/dashboard/profile-settings-board";
import { BuyerGate } from "@/components/marketing/admin-cannot-buy-notice";
import { CheckoutLotMobileChrome } from "@/components/sections/checkout/checkout-lot-mobile-chrome";
import {
  type CheckoutPaymentActionData,
  createCheckoutPaymentAction,
} from "@/lib/actions/checkout";
import { trackBeginCheckout, trackPurchase } from "@/lib/analytics/events";
import {
  checkoutPaymentErrorMessage,
  manualReviewReasonCopy,
} from "@/lib/checkout/checkout-payment-errors";
import { dashboardCheckoutLotUrl } from "@/lib/dashboard/dashboard-copy";
import type { SessionUser } from "@/lib/data/contracts";
import { notifyAdminCannotBuyIfNeeded } from "@/lib/ui/admin-cannot-buy";
import { notify } from "@/lib/ui/notify";
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
import {
  type CheckoutTermsAcceptanceValues,
  checkoutTermsAcceptanceSchema,
} from "@auction/validators";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, ShieldCheck, Truck, VerifiedIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";

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
};

function settlementsEmail(): string {
  return process.env.NEXT_PUBLIC_SETTLEMENTS_EMAIL?.trim() || "settlements@example.com";
}

function settlementsPhone(): string {
  return process.env.NEXT_PUBLIC_SETTLEMENTS_PHONE?.trim() || "+1 (000) 000-0000";
}

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

function formatAddressLines(address: ProfileAddressRow): string {
  const line2 = address.line2 ? `, ${address.line2}` : "";
  return `${address.line1}${line2}, ${address.city}, ${address.postalCode}, ${address.country}`;
}

function addressesSettingsHref(lotId: string): string {
  const next = encodeURIComponent(dashboardCheckoutLotUrl(lotId));
  return `/dashboard/settings/addresses?next=${next}`;
}

function PaymentCompleteBlock() {
  return (
    <output className="block rounded-xl border border-primary/20 bg-primary-container/15 px-6 py-8 text-center shadow-sm sm:px-8 sm:py-10">
      <p className="mb-2 font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary">
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

function ManualReviewBlock({ reason }: { reason: ManualReviewReason | null }) {
  return (
    <output className="block rounded-xl border border-border-hairline bg-surface-container-low/80 px-6 py-8 shadow-sm sm:px-8">
      <p className="font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
        Finance review
      </p>
      <p className="mt-3 font-body text-sm leading-relaxed text-on-surface-variant">
        {manualReviewReasonCopy(reason)}
      </p>
      <p className="mt-4 break-all font-body text-sm text-on-surface">{settlementsEmail()}</p>
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
}: Props) {
  const [submitted, setSubmitted] = useState(false);
  const [redirectingToStripe, setRedirectingToStripe] = useState(false);
  const [submittedReviewReason, setSubmittedReviewReason] = useState<ManualReviewReason | null>(
    null,
  );
  const addresses = rawAddresses.map(parseAddress);
  const checkoutAddresses = addresses.filter(
    (address) => address.addressType === "shipping" || address.addressType === "both",
  );
  const billingOnlyAddresses = addresses.filter((address) => address.addressType === "billing");
  const defaultAddress =
    checkoutAddresses.find((address) => address.isDefault) ?? checkoutAddresses[0];
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
    if (totalMinor != null && totalMinor > 0 && !paymentComplete) {
      trackBeginCheckout({ lotId, valueMinor: totalMinor, currency });
    }
  }, [lotId, totalMinor, currency, paymentComplete]);

  if (paymentComplete) {
    return (
      <div id="checkout-complete-purchase" className="scroll-mt-28">
        <PaymentCompleteBlock />
      </div>
    );
  }

  if (openPaymentStatus === "requires_manual_review" && !submitted) {
    return (
      <div id="checkout-complete-purchase" className="scroll-mt-28">
        <ManualReviewBlock reason={openPaymentManualReviewReason} />
      </div>
    );
  }

  if (submitted && !submittedReviewReason) {
    return (
      <div id="checkout-complete-purchase" className="scroll-mt-28">
        <output className="block rounded-xl border border-primary/20 bg-primary-container/15 px-6 py-8 text-center shadow-sm sm:px-8 sm:py-10">
          <p className="mb-2 font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary">
            Request received
          </p>
          <p className="font-headline text-2xl text-on-surface">Thank you, collector.</p>
          <p className="mx-auto mt-4 max-w-md font-body text-sm text-on-surface-variant">
            Your payment record has been created. If checkout is available, you&apos;ll be
            redirected to Stripe (card or UK bank transfer).
          </p>
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
          <p className="mb-2 font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary">
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

  if (submitted && submittedReviewReason) {
    return (
      <div id="checkout-complete-purchase" className="scroll-mt-28">
        <ManualReviewBlock reason={submittedReviewReason} />
      </div>
    );
  }

  const handlePaymentResult = (data: CheckoutPaymentActionData) => {
    if (totalMinor != null && totalMinor > 0 && !data.checkoutUrl) {
      trackPurchase({
        lotId,
        valueMinor: totalMinor,
        currency,
        transactionId: data.paymentId,
      });
    }
    if (data.checkoutUrl) {
      if (totalMinor != null && totalMinor > 0) {
        trackPurchase({
          lotId,
          valueMinor: totalMinor,
          currency,
          transactionId: data.paymentId,
        });
      }
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
    setSubmitted(true);
    notify.success("Payment record created", {
      description:
        "Complete payment on Stripe when checkout opens, or wait for finance review if required.",
    });
  };

  return (
    <div id="checkout-complete-purchase" className="scroll-mt-28 space-y-8">
      <Card className="min-w-0 border border-border-hairline bg-surface-container-low shadow-md max-lg:sticky max-lg:top-4 max-lg:z-10 lg:sticky lg:top-4 lg:z-10 lg:shadow-lg">
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
            <Separator className="bg-outline-variant/15" />
            <div className="flex min-w-0 justify-between gap-4 pt-2">
              <dt className="font-headline text-xl text-on-surface">Total due</dt>
              <dd className="shrink-0 font-headline text-2xl tabular-nums text-primary sm:text-3xl">
                {total}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card className="min-w-0 border border-border-hairline bg-surface-container-high/40 shadow-sm">
        <CardContent className="p-6 sm:p-8">
          <h2 className="mb-4 font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
            Payment
          </h2>
          <p className="mb-6 font-body text-sm leading-relaxed text-on-surface-variant">
            Pay by card (up to £100,000) or UK bank transfer via secure Stripe Checkout. High-value
            purchases may require finance review before checkout is issued.
          </p>
          <p className="font-body text-sm text-on-surface">
            <span className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary">
              Concierge
            </span>
            <br />
            <span className="break-all">{settlementsEmail()}</span>
            <br />
            <span className="text-on-surface-variant">{settlementsPhone()}</span>
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
            onSubmit={form.handleSubmit(async (values) => {
              form.clearErrors("root");
              const r = await createCheckoutPaymentAction(lotId, values.addressId);
              if (!r.ok) {
                notifyAdminCannotBuyIfNeeded(r.error, r.status ?? 500);
                const msg = r.errorCode
                  ? checkoutPaymentErrorMessage(r.error, r.errorCode)
                  : r.error;
                form.setError("root", { message: msg });
                return;
              }
              if (r.data) handlePaymentResult(r.data);
            })}
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
                          <Link href={addressesSettingsHref(lotId)} className="inline-flex gap-1">
                            <Plus className="size-3.5" aria-hidden />
                            Add new address
                          </Link>
                        </Button>
                      ) : null}
                    </div>
                    {checkoutAddresses.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-outline-variant/40 p-4">
                        <p className="font-body text-sm text-on-surface-variant">
                          Add an address before checkout so the settlements team can prepare invoice
                          and logistics details.
                        </p>
                        {billingOnlyAddresses.length > 0 ? (
                          <p className="mt-3 break-words font-body text-sm text-on-surface-variant">
                            You only have billing-specific profiles. Update one to include shipping
                            or choose “Billing & shipping” in{" "}
                            <Link
                              href={addressesSettingsHref(lotId)}
                              className="text-primary underline"
                            >
                              addresses
                            </Link>
                            .
                          </p>
                        ) : null}
                        <Button asChild variant="secondary" className="mt-4">
                          <Link href={addressesSettingsHref(lotId)}>Add address</Link>
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
                        {checkoutAddresses.map((address) => {
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
                              className={`h-auto min-h-11 w-full min-w-0 justify-start whitespace-normal rounded-lg border p-4 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                                selected
                                  ? "border-primary bg-primary-container/10"
                                  : "border-border-hairline bg-surface-container-low/30 hover:border-primary/50"
                              }`}
                            >
                              <span className="block font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface">
                                {address.label}
                                {address.isDefault ? " · Default" : ""}
                              </span>
                              <span className="mt-1 block break-words font-body text-sm text-on-surface-variant">
                                {formatAddressLines(address)}
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
                Separate billing addresses remain on file for invoicing. The selection above covers
                shipment and primary invoice delivery unless operations specifies otherwise.
              </p>
            ) : null}
            {selectedAddress ? (
              <output className="block break-words font-body text-sm text-on-surface-variant">
                <span className="font-medium text-on-surface">Shipping to:</span>{" "}
                {selectedAddress.label}
                {" — "}
                {formatAddressLines(selectedAddress)}
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
                        className="border-b border-primary/40 text-on-surface hover:border-primary"
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

      <CheckoutLotMobileChrome
        totalLabel={total}
        formId="checkout-purchase-form"
        isSubmitting={form.formState.isSubmitting}
        disabled={!canSubmit}
      />
    </div>
  );
}
