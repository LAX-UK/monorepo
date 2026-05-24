"use client";

import type { ProfileAddressRow } from "@/components/dashboard/profile-settings-board";
import { BuyerGate } from "@/components/marketing/admin-cannot-buy-notice";
import { createCheckoutPaymentAction } from "@/lib/actions/checkout";
import { trackBeginCheckout, trackPurchase } from "@/lib/analytics/events";
import type { SessionUser } from "@/lib/data/contracts";
import { notifyAdminCannotBuyIfNeeded } from "@/lib/ui/admin-cannot-buy";
import { notify } from "@/lib/ui/notify";
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
import { ShieldCheck, Truck, VerifiedIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

type Props = {
  sessionUser: SessionUser;
  lotId: string;
  hammer: string;
  buyerPremium: string;
  total: string;
  /** Checkout total in minor units (for analytics). */
  totalMinor?: number;
  /** ISO currency for analytics (defaults to GBP). */
  currency?: string;
  premiumPercentLabel: string;
  addresses: unknown[];
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

export function CheckoutPurchasePanel({
  sessionUser,
  lotId,
  hammer,
  buyerPremium,
  total,
  totalMinor,
  currency = "GBP",
  premiumPercentLabel,
  addresses: rawAddresses,
}: Props) {
  const [submitted, setSubmitted] = useState(false);
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

  useEffect(() => {
    if (totalMinor != null && totalMinor > 0) {
      trackBeginCheckout({ lotId, valueMinor: totalMinor, currency });
    }
  }, [lotId, totalMinor, currency]);

  if (submitted) {
    return (
      <div id="checkout-complete-purchase" className="scroll-mt-28">
        <output className="block rounded-xl border border-primary/20 bg-primary-container/15 px-8 py-10 text-center shadow-sm">
          <p className="mb-2 font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary">
            Request received
          </p>
          <p className="font-headline text-2xl text-on-surface">Thank you, collector.</p>
          <p className="mx-auto mt-4 max-w-md font-body text-sm text-on-surface-variant">
            Your payment record has been created. If checkout is available, you&apos;ll be
            redirected to Stripe (card or UK bank transfer). High-value lots may require finance
            review before checkout is issued.
          </p>
        </output>
      </div>
    );
  }

  return (
    <div id="checkout-complete-purchase" className="scroll-mt-28 space-y-10">
      <Card className="max-lg:sticky max-lg:top-4 max-lg:z-10 border border-border-hairline bg-surface-container-low shadow-md max-lg:shadow-lg">
        <CardContent className="p-8 pt-8">
          <h2 className="mb-8 font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
            Order summary
          </h2>
          <dl className="space-y-4 font-body text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-on-surface-variant">Hammer price</dt>
              <dd className="font-headline text-lg tabular-nums text-on-surface">{hammer}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-on-surface-variant">
                Buyer&apos;s premium ({premiumPercentLabel})
              </dt>
              <dd className="font-headline text-lg tabular-nums text-primary">{buyerPremium}</dd>
            </div>
            <Separator className="bg-outline-variant/10" />
            <div className="flex justify-between gap-4">
              <dt className="text-on-surface-variant">Shipping &amp; logistics</dt>
              <dd className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
                Quoted after payment
              </dd>
            </div>
            <Separator className="bg-outline-variant/15" />
            <div className="flex justify-between gap-4 pt-2">
              <dt className="font-headline text-xl text-on-surface">Total due</dt>
              <dd className="font-headline text-3xl tabular-nums text-primary">{total}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card className="border border-border-hairline bg-surface-container-high/40 shadow-sm">
        <CardContent className="p-8 pt-8">
          <h2 className="mb-4 font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
            Payment
          </h2>
          <p className="mb-6 font-body text-sm leading-relaxed text-on-surface-variant">
            Pay by card (up to £100,000) or UK bank transfer via secure Stripe Checkout. High-value
            purchases may require finance review before checkout is issued. Contact concierge below
            if you need help.
          </p>
          <p className="font-body text-sm text-on-surface">
            <span className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary">
              Concierge
            </span>
            <br />
            {settlementsEmail()}
            <br />
            <span className="text-on-surface-variant">{settlementsPhone()}</span>
          </p>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-x-8 gap-y-3 border-y border-border-hairline py-6 font-label text-xs font-bold uppercase tracking-[0.2em] text-on-surface-variant">
        <span className="inline-flex items-center gap-2">
          <ShieldCheck className="size-4 text-primary" aria-hidden />
          Payment protection
        </span>
        <span className="inline-flex items-center gap-2">
          <VerifiedIcon className="size-4 text-primary" aria-hidden />
          Certificate included
        </span>
        <span className="inline-flex items-center gap-2">
          <Truck className="size-4 text-primary" aria-hidden />
          Insured shipping
        </span>
      </div>

      <BuyerGate user={sessionUser}>
        <Form {...form}>
          <form
            className="space-y-6"
            onSubmit={form.handleSubmit(async (values) => {
              form.clearErrors("root");
              const r = await createCheckoutPaymentAction(lotId, values.addressId);
              if (!r.ok) {
                notifyAdminCannotBuyIfNeeded(r.error, r.status ?? 500);
                form.setError("root", { message: r.error });
                return;
              }
              const checkoutUrl = r.ok ? (r.data?.checkoutUrl ?? null) : null;
              const paymentId = r.ok ? r.data?.paymentId : undefined;
              if (totalMinor != null && totalMinor > 0) {
                trackPurchase({
                  lotId,
                  valueMinor: totalMinor,
                  currency,
                  ...(paymentId ? { transactionId: paymentId } : {}),
                });
              }
              if (checkoutUrl) {
                window.location.assign(checkoutUrl);
                return;
              }
              setSubmitted(true);
              notify.success("Payment record created", {
                description:
                  "Complete payment on Stripe when checkout opens, or wait for finance review if your lot requires manual approval.",
              });
            })}
          >
            <FormField
              control={form.control}
              name="addressId"
              render={({ field }) => (
                <FormItem>
                  <div className="space-y-3">
                    <FormLabel className="font-label text-xs font-bold uppercase tracking-[0.2em] text-secondary">
                      Shipping / invoice address
                    </FormLabel>
                    {checkoutAddresses.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-outline-variant/40 p-4">
                        <p className="font-body text-sm text-on-surface-variant">
                          Add an address before checkout so the settlements team can prepare invoice
                          and logistics details.
                        </p>
                        {billingOnlyAddresses.length > 0 ? (
                          <p className="mt-3 font-body text-sm text-on-surface-variant">
                            You only have billing-specific profiles. Update one to include shipping
                            or choose “Billing & shipping” in{" "}
                            <Link
                              href="/dashboard/settings/addresses"
                              className="text-primary underline"
                            >
                              addresses
                            </Link>
                            .
                          </p>
                        ) : null}
                        <Button asChild variant="secondary" className="mt-4">
                          <Link href="/dashboard/settings/addresses">Add address</Link>
                        </Button>
                      </div>
                    ) : (
                      <div className="grid gap-3" aria-label="Select shipping or invoice address">
                        {checkoutAddresses.map((address) => {
                          const selected = field.value === address.id;
                          return (
                            <button
                              key={address.id}
                              type="button"
                              aria-pressed={selected}
                              onClick={() => field.onChange(address.id)}
                              className={`rounded-lg border p-4 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                                selected
                                  ? "border-primary bg-primary-container/10"
                                  : "border-border-hairline bg-surface-container-low/30 hover:border-primary/50"
                              }`}
                            >
                              <span className="block font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface">
                                {address.label}
                                {address.isDefault ? " · Default" : ""}
                              </span>
                              <span className="mt-1 block font-body text-sm text-on-surface-variant">
                                {address.line1}
                                {address.line2 ? `, ${address.line2}` : ""}, {address.city},{" "}
                                {address.postalCode}, {address.country}
                              </span>
                            </button>
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
              <p className="font-body text-xs text-on-surface-variant" role="note">
                Separate billing addresses remain on file for invoicing. The selection above covers
                shipment and primary invoice delivery unless operations specifies otherwise.
              </p>
            ) : null}
            <FormField
              control={form.control}
              name="termsAccepted"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start gap-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={(v) => field.onChange(v === true)}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
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
              <p className="text-sm text-error" role="alert">
                {form.formState.errors.root.message}
              </p>
            ) : null}
            <Button
              type="submit"
              disabled={form.formState.isSubmitting}
              className="h-auto min-h-11 w-full py-5"
            >
              {form.formState.isSubmitting ? "Processing…" : "Complete purchase"}
            </Button>
          </form>
        </Form>
      </BuyerGate>
    </div>
  );
}
