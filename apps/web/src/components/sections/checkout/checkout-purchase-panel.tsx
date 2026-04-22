"use client";

import { BuyerGate } from "@/components/marketing/admin-cannot-buy-notice";
import { Button } from "@/components/ui/button";
import { createCheckoutPaymentAction } from "@/lib/actions/checkout";
import type { SessionUser } from "@/lib/data/contracts";
import { notifyAdminCannotBuyIfNeeded } from "@/lib/ui/admin-cannot-buy";
import { Checkbox } from "@auction/ui/components/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@auction/ui/components/form";
import {
  type CheckoutTermsAcceptanceValues,
  checkoutTermsAcceptanceSchema,
} from "@auction/validators";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

type Props = {
  sessionUser: SessionUser;
  lotId: string;
  hammer: string;
  buyerPremium: string;
  total: string;
  premiumPercentLabel: string;
};

function settlementsEmail(): string {
  return process.env.NEXT_PUBLIC_SETTLEMENTS_EMAIL?.trim() || "settlements@example.com";
}

function settlementsPhone(): string {
  return process.env.NEXT_PUBLIC_SETTLEMENTS_PHONE?.trim() || "+1 (000) 000-0000";
}

export function CheckoutPurchasePanel({
  sessionUser,
  lotId,
  hammer,
  buyerPremium,
  total,
  premiumPercentLabel,
}: Props) {
  const [submitted, setSubmitted] = useState(false);
  const form = useForm<CheckoutTermsAcceptanceValues>({
    resolver: zodResolver(checkoutTermsAcceptanceSchema),
    defaultValues: { termsAccepted: false },
  });

  if (submitted) {
    return (
      <output className="block rounded-xl bg-primary-container/15 px-8 py-10 text-center ring-1 ring-primary/25">
        <p className="mb-2 font-label text-xs font-bold uppercase tracking-[0.3em] text-primary">
          Request received
        </p>
        <p className="font-headline text-2xl text-on-surface">Thank you, collector.</p>
        <p className="mx-auto mt-4 max-w-md font-body text-sm text-on-surface-variant">
          Your payment record has been created. When online checkout is enabled, you&apos;ll
          complete payment here; until then our settlements team will follow up with wire or other
          instructions.
        </p>
      </output>
    );
  }

  return (
    <div className="space-y-10">
      <div className="rounded-xl bg-surface-container-low p-8 shadow-sm ring-1 ring-outline-variant/10 max-lg:sticky max-lg:top-4 max-lg:z-10 max-lg:shadow-md">
        <h2 className="mb-8 font-label text-xs font-bold uppercase tracking-[0.3em] text-secondary">
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
          <div className="flex justify-between gap-4 border-t border-outline-variant/10 pt-4">
            <dt className="text-on-surface-variant">Shipping &amp; logistics</dt>
            <dd className="font-label text-xs uppercase tracking-widest text-secondary">
              Quoted after payment
            </dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-outline-variant/15 pt-6">
            <dt className="font-headline text-xl text-on-surface">Total due</dt>
            <dd className="font-headline text-3xl tabular-nums text-primary">{total}</dd>
          </div>
        </dl>
      </div>

      <div className="rounded-xl bg-surface-container-high/40 p-8 ring-1 ring-outline-variant/10">
        <h2 className="mb-4 font-label text-xs font-bold uppercase tracking-[0.3em] text-secondary">
          Payment
        </h2>
        <p className="mb-6 font-body text-sm leading-relaxed text-on-surface-variant">
          High-value lots are settled by bank transfer. Card payments may be available for
          qualifying invoices—your specialist will confirm options and any processing fees.
        </p>
        <p className="font-body text-sm text-on-surface">
          <span className="font-label text-xs uppercase tracking-widest text-primary">
            Concierge
          </span>
          <br />
          {settlementsEmail()}
          <br />
          <span className="text-on-surface-variant">{settlementsPhone()}</span>
        </p>
      </div>

      <div className="flex flex-wrap gap-x-8 gap-y-3 border-y border-outline-variant/10 py-6 font-label text-xs font-bold uppercase tracking-[0.2em] text-on-surface-variant">
        <span className="inline-flex items-center gap-2">
          <span className="material-symbols-outlined text-base text-primary" aria-hidden>
            security
          </span>
          Secure escrow
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="material-symbols-outlined text-base text-primary" aria-hidden>
            verified
          </span>
          Certificate included
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="material-symbols-outlined text-base text-primary" aria-hidden>
            local_shipping
          </span>
          Insured shipping
        </span>
      </div>

      <BuyerGate user={sessionUser}>
        <Form {...form}>
          <form
            className="space-y-6"
            onSubmit={form.handleSubmit(async () => {
              form.clearErrors("root");
              const r = await createCheckoutPaymentAction(lotId);
              if (!r.ok) {
                notifyAdminCannotBuyIfNeeded(r.error, r.status ?? 500);
                form.setError("root", { message: r.error });
                return;
              }
              setSubmitted(true);
              toast.success("Payment record created", {
                description: "Our settlements team will follow up with next steps.",
              });
            })}
          >
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
                        Terms of Sale
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
              id="checkout-complete-purchase"
              type="submit"
              variant="primary"
              disabled={form.formState.isSubmitting}
              className="w-full min-h-11 scroll-mt-28 py-5"
            >
              {form.formState.isSubmitting ? "Processing…" : "Complete purchase"}
            </Button>
          </form>
        </Form>
      </BuyerGate>
    </div>
  );
}
