"use client";

import { startCheckout } from "@/app/actions/checkout.actions";
import { CheckoutBasketSummary } from "@/components/checkout/checkout-basket-summary";
import { ShopCommerceButton } from "@/components/shop-commerce-button";
import { ShopNotice } from "@/components/shop-notice";
import { ShopStatusState } from "@/components/shop-status-state";
import { formatGbpPence } from "@/lib/presenters/shop-money.presenter";
import type { ShopDeliveryAddressInput, ShopFulfilmentOption } from "@/lib/shop-fulfilment";
import { isValidUkPostcode } from "@/lib/uk-postcode";
import { SITE_SUPPORT_EMAIL } from "@auction/branding";
import type { BasketView } from "@auction/shop-contracts";
import { fulfilmentSurchargePence } from "@auction/shop-domain";
import { Input, Label, RadioCardGroup } from "@auction/ui";
import { useMemo, useState, useTransition } from "react";

const FULFILMENT_OPTION_META: Array<{
  id: ShopFulfilmentOption;
  label: string;
  descriptionBase?: string;
}> = [
  { id: "uk_insured_delivery", label: "UK insured delivery" },
  { id: "collect_new_cavendish", label: "Collect — New Cavendish Street" },
  { id: "collect_brunswick", label: "Collect — Brunswick" },
  { id: "lax_storage", label: "LAX storage" },
  {
    id: "international_quotation",
    label: "International delivery (quotation)",
    descriptionBase: "We will email you a delivery quote before payment.",
  },
];

function fulfilmentOptionDescription(option: ShopFulfilmentOption): string | undefined {
  const meta = FULFILMENT_OPTION_META.find((entry) => entry.id === option);
  if (option === "international_quotation") {
    return meta?.descriptionBase;
  }
  const surcharge = fulfilmentSurchargePence(option);
  const priceLine =
    surcharge === 0
      ? "No fulfilment surcharge"
      : `${formatGbpPence(surcharge)} fulfilment surcharge`;
  return priceLine;
}

type Props = {
  basket: BasketView;
  customerEmail?: string;
};

export function CheckoutForm({ basket, customerEmail }: Props) {
  const [fulfilment, setFulfilment] = useState<ShopFulfilmentOption>("uk_insured_delivery");
  const [delivery, setDelivery] = useState<ShopDeliveryAddressInput>({
    line1: "",
    line2: "",
    city: "",
    postcode: "",
    country: "GB",
  });
  const [pending, startTransition] = useTransition();
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [postcodeError, setPostcodeError] = useState<string | null>(null);
  const fieldsDisabled = pending || redirecting;

  const fulfilmentOptions = useMemo(
    () =>
      FULFILMENT_OPTION_META.map((option) => {
        const description = fulfilmentOptionDescription(option.id);
        return {
          value: option.id,
          label: option.label,
          disabled: fieldsDisabled,
          ...(description ? { description } : {}),
        };
      }),
    [fieldsDisabled],
  );

  const paymentButtonLabel =
    fulfilment === "international_quotation"
      ? "Request delivery quote"
      : redirecting
        ? "Redirecting to secure payment…"
        : pending
          ? "Starting payment…"
          : "Continue to payment";

  return (
    <div className="shop-checkout__layout">
      <CheckoutBasketSummary basket={basket} fulfilment={fulfilment} />
      <form
        className="shop-checkout__form"
        onSubmit={(event) => {
          event.preventDefault();
        }}
      >
        {customerEmail ? (
          <p className="shop-checkout__paying-as">
            Paying as <strong>{customerEmail}</strong>
          </p>
        ) : null}
        <div className="shop-checkout__fieldset">
          <RadioCardGroup
            legend="Fulfilment"
            value={fulfilment}
            onValueChange={(value) => setFulfilment(value as ShopFulfilmentOption)}
            options={fulfilmentOptions}
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
                  disabled={fieldsDisabled}
                  value={delivery.line1}
                  onChange={(event) => setDelivery({ ...delivery, line1: event.target.value })}
                  autoComplete="address-line1"
                />
              </div>
              <div className="shop-checkout__field shop-checkout__field--full">
                <Label htmlFor="checkout-line2">Address line 2 (optional)</Label>
                <Input
                  id="checkout-line2"
                  disabled={fieldsDisabled}
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
                  disabled={fieldsDisabled}
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
                  disabled={fieldsDisabled}
                  value={delivery.postcode}
                  aria-invalid={postcodeError ? true : undefined}
                  aria-describedby={postcodeError ? "checkout-postcode-error" : undefined}
                  onChange={(event) => {
                    setPostcodeError(null);
                    setDelivery({ ...delivery, postcode: event.target.value });
                  }}
                  autoComplete="postal-code"
                />
                {postcodeError ? (
                  <ShopNotice tone="error" title="Invalid postcode" className="mt-2">
                    {postcodeError}
                  </ShopNotice>
                ) : null}
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
        <ShopCommerceButton
          type="button"
          disabled={fieldsDisabled}
          onClick={() => {
            setError(null);
            setPostcodeError(null);
            if (fulfilment === "uk_insured_delivery" && !isValidUkPostcode(delivery.postcode)) {
              const message = "Enter a valid UK postcode (for example SW1A 1AA).";
              setPostcodeError(message);
              document.getElementById("checkout-postcode")?.focus();
              return;
            }
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
                window.open(
                  `mailto:${SITE_SUPPORT_EMAIL}?subject=${encodeURIComponent("International delivery quotation")}`,
                  "_self",
                );
                return;
              }
              if (result.kind === "error") {
                setError(result.message);
                return;
              }
              setRedirecting(true);
              window.location.href = result.checkoutUrl;
            });
          }}
        >
          {paymentButtonLabel}
        </ShopCommerceButton>
      </form>
    </div>
  );
}
