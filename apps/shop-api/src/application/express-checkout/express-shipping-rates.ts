import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { FULFILMENT_SURCHARGE_PENCE } from "@auction/shop-domain";
import { ShopApiError } from "../../errors/shop-api-error.js";
import type {
  ExpressShippingRate,
  ExpressShippingRateId,
} from "../ports/express-checkout.ports.js";

/**
 * The two rates the wallet sheet offers, priced from the same table as the Details form (Q5:
 * collection is a zero-price rate). International delivery and quotes stay on the form.
 */
export const EXPRESS_SHIPPING_RATES: readonly ExpressShippingRate[] = [
  {
    id: "uk_insured_delivery",
    displayName: "Insured UK delivery",
    amountPence: FULFILMENT_SURCHARGE_PENCE.uk_insured_delivery,
  },
  {
    id: "collect_new_cavendish",
    displayName: "Collect from our London gallery",
    amountPence: FULFILMENT_SURCHARGE_PENCE.collect_new_cavendish,
  },
];

export const EXPRESS_UK_ONLY_MESSAGE =
  "Express checkout delivers to UK addresses only. For delivery abroad, continue below to ask for a quote.";

export function expressShippingRate(id: ExpressShippingRateId): ExpressShippingRate {
  const rate = EXPRESS_SHIPPING_RATES.find((candidate) => candidate.id === id);
  if (!rate) {
    throw new ShopApiError(SHOP_API_ERROR_CODES.VALIDATION, "Choose a delivery option", 400);
  }
  return rate;
}

/** "GB" for a UK country code as wallets send it ("GB", "gb", "UK"); null for anything else. */
export function ukCountryCode(country: string): "GB" | null {
  const code = country.trim().toUpperCase();
  return code === "GB" || code === "UK" ? "GB" : null;
}

/**
 * The rates for the address the wallet reports while the sheet is open (the address change
 * handler). Wallets hide the street until confirm, so only the country decides: a UK address gets
 * both rates, anything else is refused with a message the sheet shows.
 */
export function expressShippingRatesForAddress(address: {
  country: string;
}): readonly ExpressShippingRate[] {
  if (!ukCountryCode(address.country)) {
    throw new ShopApiError(SHOP_API_ERROR_CODES.VALIDATION, EXPRESS_UK_ONLY_MESSAGE, 400);
  }
  return EXPRESS_SHIPPING_RATES;
}
