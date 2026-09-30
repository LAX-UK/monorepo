"use client";

import { startCheckout } from "@/app/actions/checkout.actions";
import { CheckoutBasketSummary } from "@/components/checkout/checkout-basket-summary";
import { ShopStatusState } from "@/components/shop-status-state";
import type { ShopDeliveryAddressInput, ShopFulfilmentOption } from "@/lib/shop-fulfilment";
import { SITE_SUPPORT_EMAIL } from "@auction/branding";
import type { BasketView } from "@auction/shop-contracts";
import { Input, Label, RadioCardGroup } from "@auction/ui";
import { useState, useTransition } from "react";

const FULFILMENT_OPTIONS: Array<{ id: ShopFulfilmentOption; label: string; description?: string }> =
  [
    { id: "uk_insured_delivery", label: "UK insured delivery" },
    { id: "collect_new_cavendish", label: "Collect — New Cavendish Street" },
    { id: "collect_brunswick", label: "Collect — Brunswick" },
    { id: "lax_storage", label: "LAX storage" },
    {
      id: "international_quotation",
      label: "International delivery (quotation)",
      description: "We will email you a delivery quote before payment.",
    },
  ];

type Props = {
  basket: BasketView;
};

export function CheckoutForm({ basket }: Props) {
  const [fulfilment, setFulfilment] = useState<ShopFulfilmentOption>("uk_insured_delivery");
  const [delivery, setDelivery] = useState<ShopDeliveryAddressInput>({
    line1: "",
    line2: "",
    city: "",
    postcode: "",
    country: "GB",
  });
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="shop-checkout__layout">
      <CheckoutBasketSummary basket={basket} fulfilment={fulfilment} />
      <form
        className="shop-checkout__form"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          startTransition(async () => {
            const deliveryAddress =
              fulfilment === "uk_insured_delivery"
                ? {
                    line1: delivery.line1.trim(),
                    city: delivery.city.trim(),
                    postcode: delivery.postcode.trim(),
                    country: delivery.country.trim(),
                    ...(delivery.line2?.trim() ? { line2: delivery.line2.trim() } : {}),
                  }
                : undefined;
            const result = await startCheckout({
              basketId: basket.basketId,
              fulfilment,
              ...(deliveryAddress ? { deliveryAddress } : {}),
            });
            if (result.kind === "enquiry") {
              window.location.href = `mailto:${SITE_SUPPORT_EMAIL}?subject=${encodeURIComponent("International delivery quotation")}`;
              return;
            }
            if (result.kind === "error") {
              setError(result.message);
              return;
            }
            window.location.href = result.checkoutUrl;
          });
        }}
      >
        <div className="shop-checkout__fieldset">
          <RadioCardGroup
            legend="Fulfilment"
            value={fulfilment}
            onValueChange={(value) => setFulfilment(value as ShopFulfilmentOption)}
            options={FULFILMENT_OPTIONS.map((option) => ({
              value: option.id,
              label: option.label,
              ...(option.description ? { description: option.description } : {}),
            }))}
          />
        </div>
        {fulfilment === "uk_insured_delivery" ? (
          <fieldset className="shop-checkout__fieldset">
            <legend className="shop-checkout__legend">Delivery address</legend>
            <div className="shop-checkout__field-grid">
              <div className="shop-checkout__field shop-checkout__field--full">
                <Label htmlFor="checkout-line1">Address line 1</Label>
                <Input
                  id="checkout-line1"
                  required
                  value={delivery.line1}
                  onChange={(event) => setDelivery({ ...delivery, line1: event.target.value })}
                  autoComplete="address-line1"
                />
              </div>
              <div className="shop-checkout__field shop-checkout__field--full">
                <Label htmlFor="checkout-line2">Address line 2 (optional)</Label>
                <Input
                  id="checkout-line2"
                  value={delivery.line2 ?? ""}
                  onChange={(event) => setDelivery({ ...delivery, line2: event.target.value })}
                  autoComplete="address-line2"
                />
              </div>
              <div className="shop-checkout__field">
                <Label htmlFor="checkout-city">City</Label>
                <Input
                  id="checkout-city"
                  required
                  value={delivery.city}
                  onChange={(event) => setDelivery({ ...delivery, city: event.target.value })}
                  autoComplete="address-level2"
                />
              </div>
              <div className="shop-checkout__field">
                <Label htmlFor="checkout-postcode">Postcode</Label>
                <Input
                  id="checkout-postcode"
                  required
                  value={delivery.postcode}
                  onChange={(event) => setDelivery({ ...delivery, postcode: event.target.value })}
                  autoComplete="postal-code"
                />
              </div>
              <div className="shop-checkout__field shop-checkout__field--full">
                <Label htmlFor="checkout-country">Country</Label>
                <Input id="checkout-country" readOnly value="United Kingdom (GB)" />
                <input type="hidden" name="country" value={delivery.country} />
              </div>
            </div>
          </fieldset>
        ) : null}
        {error ? (
          <ShopStatusState
            variant="error"
            layout="inline"
            icon="alert"
            title="Checkout could not continue"
            description={error}
            announcement="assertive"
          />
        ) : null}
        <button type="submit" className="shop-detail__cta shop-focus-ring" disabled={pending}>
          {pending ? "Starting payment…" : "Continue to payment"}
        </button>
      </form>
    </div>
  );
}
