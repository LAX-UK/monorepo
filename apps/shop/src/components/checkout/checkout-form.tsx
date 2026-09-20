"use client";

import { startCheckout } from "@/app/actions/checkout.actions";
import type { ShopDeliveryAddressInput, ShopFulfilmentOption } from "@/lib/shop-fulfilment";
import { SITE_SUPPORT_EMAIL } from "@auction/branding";
import { useState, useTransition } from "react";

const FULFILMENT_OPTIONS: Array<{ id: ShopFulfilmentOption; label: string }> = [
  { id: "uk_insured_delivery", label: "UK insured delivery" },
  { id: "collect_new_cavendish", label: "Collect — New Cavendish Street" },
  { id: "collect_brunswick", label: "Collect — Brunswick" },
  { id: "lax_storage", label: "LAX storage" },
  { id: "international_quotation", label: "International delivery (quotation)" },
];

type Props = {
  basketId: string;
};

export function CheckoutForm({ basketId }: Props) {
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
            basketId,
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
      <fieldset>
        <legend>Fulfilment</legend>
        {FULFILMENT_OPTIONS.map((option) => (
          <label key={option.id} className="shop-checkout__option">
            <input
              type="radio"
              name="fulfilment"
              value={option.id}
              checked={fulfilment === option.id}
              onChange={() => setFulfilment(option.id)}
            />
            {option.label}
          </label>
        ))}
      </fieldset>
      {fulfilment === "uk_insured_delivery" ? (
        <fieldset>
          <legend>Delivery address</legend>
          <label>
            Address line 1
            <input
              required
              value={delivery.line1}
              onChange={(event) => setDelivery({ ...delivery, line1: event.target.value })}
            />
          </label>
          <label>
            Address line 2
            <input
              value={delivery.line2 ?? ""}
              onChange={(event) => setDelivery({ ...delivery, line2: event.target.value })}
            />
          </label>
          <label>
            City
            <input
              required
              value={delivery.city}
              onChange={(event) => setDelivery({ ...delivery, city: event.target.value })}
            />
          </label>
          <label>
            Postcode
            <input
              required
              value={delivery.postcode}
              onChange={(event) => setDelivery({ ...delivery, postcode: event.target.value })}
            />
          </label>
          <label>
            Country (ISO code)
            <input
              required
              maxLength={2}
              value={delivery.country}
              onChange={(event) =>
                setDelivery({ ...delivery, country: event.target.value.toUpperCase() })
              }
            />
          </label>
        </fieldset>
      ) : null}
      {error ? (
        <p className="shop-basket__alert" role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" className="shop-detail__cta shop-focus-ring" disabled={pending}>
        {pending ? "Starting payment…" : "Continue to payment"}
      </button>
    </form>
  );
}
