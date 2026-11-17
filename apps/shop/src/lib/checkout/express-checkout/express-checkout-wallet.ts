import { isValidUkPostcode, normalizeUkPostcode } from "@/lib/uk-postcode";
import type { ExpressRate, ExpressRateId } from "./express-checkout-api";

/**
 * The parts of Stripe's Express Checkout Element events the Shop reads. Stripe sends more; only
 * these fields are trusted, and every one is checked before it reaches the Shop's API.
 */
export type WalletAddress = {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  postal_code?: string | null;
  country?: string | null;
};

export type WalletShippingAddressChange = {
  address?: WalletAddress | null;
};

export type WalletConfirmEvent = {
  billingDetails?: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  shippingAddress?: { name?: string | null; address?: WalletAddress | null } | null;
  shippingRate?: { id?: string | null; displayName?: string | null; amount?: number | null } | null;
};

/** The address the sheet reports while open: only the country, and the postcode or town. */
export function walletAddressChange(event: WalletShippingAddressChange): {
  country: string;
  postcode?: string;
  city?: string;
} {
  const address = event.address ?? {};
  const postcode = address.postal_code?.trim().slice(0, 16);
  const city = address.city?.trim().slice(0, 200);
  return {
    country: (address.country ?? "").trim().toUpperCase().slice(0, 2),
    ...(postcode ? { postcode } : {}),
    ...(city ? { city } : {}),
  };
}

/**
 * The rate the shopper chose in the sheet. Stripe names inline rates with its own ids, so the
 * rate is matched by the name and price the Shop gave it.
 */
export function walletRateId(
  chosen: WalletConfirmEvent["shippingRate"],
  rates: readonly ExpressRate[],
): ExpressRateId | null {
  if (!chosen) return null;
  const byName = rates.find((rate) => rate.displayName === chosen.displayName?.trim());
  if (byName) return byName.id;
  const byAmount = rates.filter((rate) => rate.amountPence === chosen.amount);
  return byAmount.length === 1 && byAmount[0] ? byAmount[0].id : null;
}

const PHONE_PATTERN = /^\+?[0-9][0-9 ()-]{6,19}$/;

export const WALLET_MESSAGES = {
  rate: "Choose insured UK delivery or collection in the payment sheet.",
  name: "Your wallet did not share a name. Continue below to check out as usual.",
  email: "Your wallet did not share an email address. Continue below to check out as usual.",
  phone:
    "Insured delivery needs a phone number, and your wallet did not share one. Add one in the payment sheet, or continue below.",
  address:
    "Express checkout delivers to UK addresses only. Check the address in the payment sheet, or continue below.",
} as const;

export type WalletConfirmPayload = {
  shippingRateId: ExpressRateId;
  name: string;
  phone?: string;
  email?: string;
  shippingAddress: {
    recipientName: string;
    line1: string;
    line2?: string;
    city: string;
    postcode: string;
    country: "GB";
  };
};

export type WalletConfirmReading =
  | { kind: "ok"; payload: WalletConfirmPayload }
  | { kind: "invalid"; message: string };

/**
 * What the Shop's confirm needs from the sheet. Insured delivery needs a phone, as on the Details
 * form; a guest needs an email. The address is always UK (the sheet allows only GB).
 */
export function readWalletConfirm(
  event: WalletConfirmEvent,
  rates: readonly ExpressRate[],
  options: { requireEmail: boolean },
): WalletConfirmReading {
  const shippingRateId = walletRateId(event.shippingRate, rates);
  if (!shippingRateId) return { kind: "invalid", message: WALLET_MESSAGES.rate };

  const name = (event.shippingAddress?.name ?? event.billingDetails?.name ?? "")
    .trim()
    .slice(0, 200);
  if (!name) return { kind: "invalid", message: WALLET_MESSAGES.name };

  const email = event.billingDetails?.email?.trim() ?? "";
  if (options.requireEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { kind: "invalid", message: WALLET_MESSAGES.email };
  }

  const phone = event.billingDetails?.phone?.trim() ?? "";
  const validPhone = PHONE_PATTERN.test(phone) ? phone : null;
  if (shippingRateId === "uk_insured_delivery" && !validPhone) {
    return { kind: "invalid", message: WALLET_MESSAGES.phone };
  }

  const address = event.shippingAddress?.address ?? {};
  const line1 = address.line1?.trim() ?? "";
  const city = address.city?.trim() ?? "";
  const postcode = address.postal_code?.trim() ?? "";
  const country = address.country?.trim().toUpperCase();
  if (!line1 || !city || (country !== "GB" && country !== "UK") || !isValidUkPostcode(postcode)) {
    return { kind: "invalid", message: WALLET_MESSAGES.address };
  }
  const line2 = address.line2?.trim();

  return {
    kind: "ok",
    payload: {
      shippingRateId,
      name,
      ...(validPhone ? { phone: validPhone } : {}),
      ...(options.requireEmail ? { email } : {}),
      shippingAddress: {
        recipientName: name,
        line1: line1.slice(0, 200),
        ...(line2 ? { line2: line2.slice(0, 200) } : {}),
        city: city.slice(0, 120),
        postcode: normalizeUkPostcode(postcode),
        country: "GB",
      },
    },
  };
}
