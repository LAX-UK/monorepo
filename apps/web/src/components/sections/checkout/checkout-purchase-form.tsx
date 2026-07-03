"use client";

import { BuyerGate, isAdminBuyerBlocked } from "@/components/marketing/admin-cannot-buy-notice";
import { CheckoutLotMobileChrome } from "@/components/sections/checkout/checkout-lot-mobile-chrome";
import { formatCheckoutAddressLines } from "@/components/sections/checkout/use-checkout-purchase-state";
import type { SessionUser } from "@/lib/data/contracts";
import type { ProfileAddressRow } from "@/lib/data/dto/profile-dtos";
import { Button } from "@auction/ui/components/button";
import { Checkbox } from "@auction/ui/components/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@auction/ui/components/form";
import type { CheckoutTermsAcceptanceValues } from "@auction/validators";
import { Plus } from "lucide-react";
import Link from "next/link";
import type { UseFormReturn } from "react-hook-form";

type Props = {
  sessionUser: SessionUser;
  totalLabel: string;
  form: UseFormReturn<CheckoutTermsAcceptanceValues>;
  checkoutAddresses: ProfileAddressRow[];
  billingOnlyAddresses: ProfileAddressRow[];
  selectedAddress: ProfileAddressRow | null;
  canSubmit: boolean;
  addressesSettingsHref: string;
  submitCheckout: (values: CheckoutTermsAcceptanceValues) => Promise<void>;
};

export function CheckoutPurchaseForm({
  sessionUser,
  totalLabel,
  form,
  checkoutAddresses,
  billingOnlyAddresses,
  selectedAddress,
  canSubmit,
  addressesSettingsHref,
  submitCheckout,
}: Props) {
  return (
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
                      <Button type="button" variant="tertiary" size="sm" asChild className="h-auto">
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
                        Add an address before checkout so the settlements team can prepare invoice
                        and logistics details.
                      </p>
                      {billingOnlyAddresses.length > 0 ? (
                        <p className="mt-3 break-words font-body text-sm text-on-surface-variant">
                          You only have billing-specific profiles. Update one to include shipping or
                          choose “Billing & shipping” in{" "}
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
              Separate billing addresses remain on file for invoicing. The selection above covers
              shipment and primary invoice delivery unless operations specifies otherwise.
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

      {!isAdminBuyerBlocked(sessionUser) ? (
        <CheckoutLotMobileChrome
          totalLabel={totalLabel}
          formId="checkout-purchase-form"
          isSubmitting={form.formState.isSubmitting}
          disabled={!canSubmit}
        />
      ) : null}
    </BuyerGate>
  );
}
