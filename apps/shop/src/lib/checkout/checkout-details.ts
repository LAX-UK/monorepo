import type { CheckoutDeliveryChoice } from "@/lib/checkout/checkout-delivery";
import { isValidUkPostcode, normalizeUkPostcode } from "@/lib/uk-postcode";
import type { SavedDeliveryAddress } from "@auction/shop-contracts";

/** Field ids double as the error summary's link targets. */
export const CHECKOUT_FIELD_IDS = {
  contactName: "checkout-contact-name",
  savedAddress: "checkout-saved-address",
  recipientName: "checkout-recipient-name",
  line1: "checkout-line1",
  line2: "checkout-line2",
  city: "checkout-city",
  postcode: "checkout-postcode",
  country: "checkout-country",
  phone: "checkout-phone",
} as const;

export type CheckoutField = keyof typeof CHECKOUT_FIELD_IDS;

/** The order fields are checked and shown in, top to bottom as on the page. */
const FIELD_ORDER: readonly CheckoutField[] = [
  "contactName",
  "savedAddress",
  "recipientName",
  "line1",
  "line2",
  "city",
  "postcode",
  "country",
  "phone",
];

export type CheckoutDetails = {
  choice: CheckoutDeliveryChoice;
  /** The buyer's own name; asked only of a guest, whose account cannot supply it. */
  contactName: string;
  /** A saved address id, or "new" for the address form. */
  address: string;
  recipientName: string;
  line1: string;
  line2: string;
  city: string;
  postcode: string;
  /** ISO 3166-1 alpha-2 for delivery outside the UK; empty until chosen. */
  country: string;
  phone: string;
  saveAddress: boolean;
};

export type CheckoutFieldErrors = Partial<Record<CheckoutField, string>>;

/** The same rule shop-api applies to a delivery phone. */
const DELIVERY_PHONE = /^\+?[0-9][0-9 ()-]{6,19}$/;

/** Only a GB address can be chosen for UK delivery; others are listed but cannot be picked. */
export function isDeliverableSavedAddress(address: Pick<SavedDeliveryAddress, "country">): boolean {
  return address.country === "GB";
}

/** The address checkout starts on: the default UK address, else any UK one, else a new one. */
export function initialCheckoutAddress(saved: readonly SavedDeliveryAddress[]): string {
  const deliverable = saved.filter(isDeliverableSavedAddress);
  return (deliverable.find((address) => address.isDefaultShipping) ?? deliverable[0])?.id ?? "new";
}

function phoneError(phone: string): string | undefined {
  const value = phone.trim();
  if (!value) return "Enter a phone number for the courier";
  if (value.length < 8 || value.length > 20 || !DELIVERY_PHONE.test(value)) {
    return "Enter a phone number, like 07700 900123";
  }
  return undefined;
}

/** The same rule shop-api applies to a phone a courier rings, which may be from any country. */
const COURIER_PHONE = /^\+?[0-9][0-9 ()./-]{5,}$/;

/**
 * What needs fixing before asking for a delivery quote. A postal code is only required, never
 * matched to a format, because countries differ; the country must be chosen and not the UK.
 */
export function validateOutsideUkDetails(details: CheckoutDetails): CheckoutFieldErrors {
  const errors: CheckoutFieldErrors = {};
  if (!details.recipientName.trim()) {
    errors.recipientName = "Enter the full name of the person receiving the delivery";
  }
  if (!details.line1.trim()) errors.line1 = "Enter the first line of the address";
  if (!details.city.trim()) errors.city = "Enter a town or city";
  if (!details.postcode.trim()) errors.postcode = "Enter a postal code";
  else if (details.postcode.trim().length > 20) errors.postcode = "Enter a shorter postal code";
  if (!details.country.trim()) errors.country = "Choose the country";
  else if (details.country.trim().toUpperCase() === "GB") {
    errors.country = "Choose UK insured delivery for an address in the United Kingdom";
  }
  const phone = details.phone.trim();
  if (!phone) errors.phone = "Enter a phone number for the courier";
  else if (phone.length > 30 || !COURIER_PHONE.test(phone)) {
    errors.phone = "Enter a phone number with the country code, like +49 30 1234567";
  }
  return errors;
}

/**
 * What needs fixing before payment. Collection needs nothing more; UK delivery needs a phone
 * and either a saved UK address or a complete new one. Messages say how to fix the problem.
 */
export function validateCheckoutDetails(
  details: CheckoutDetails,
  saved: readonly SavedDeliveryAddress[],
  options: { requireContactName?: boolean } = {},
): CheckoutFieldErrors {
  const errors: CheckoutFieldErrors = {};
  if (options.requireContactName && !details.contactName.trim()) {
    errors.contactName = "Enter your full name";
  }
  if (details.choice === "international_quotation") {
    return { ...errors, ...validateOutsideUkDetails(details) };
  }
  if (details.choice !== "uk_insured_delivery") return errors;
  if (details.address !== "new") {
    const chosen = saved.find((address) => address.id === details.address);
    if (!chosen || !isDeliverableSavedAddress(chosen)) {
      errors.savedAddress = "Choose a UK delivery address, or use a new address";
    }
  } else {
    if (!details.recipientName.trim()) {
      errors.recipientName = "Enter the full name of the person receiving the delivery";
    }
    if (!details.line1.trim()) errors.line1 = "Enter the first line of the address";
    if (!details.city.trim()) errors.city = "Enter a town or city";
    if (!details.postcode.trim()) errors.postcode = "Enter a postcode";
    else if (!isValidUkPostcode(details.postcode)) {
      errors.postcode = "Enter a UK postcode, like SW1A 1AA";
    }
  }
  const phone = phoneError(details.phone);
  if (phone) errors.phone = phone;
  return errors;
}

/** Errors in page order, for the summary at the top of the form. */
export function orderedCheckoutErrors(
  errors: CheckoutFieldErrors,
): Array<{ fieldId: string; message: string }> {
  return FIELD_ORDER.flatMap((field) => {
    const message = errors[field];
    return message ? [{ fieldId: CHECKOUT_FIELD_IDS[field], message }] : [];
  });
}

export type CheckoutDeliveryPayload = {
  deliveryAddress: {
    recipientName: string;
    line1: string;
    line2?: string;
    city: string;
    postcode: string;
    country: "GB";
  };
  deliveryPhone: string;
  saveAddress: boolean;
};

/**
 * The delivery part of the checkout request for valid details, from the chosen saved address or
 * the form. A saved address is never saved again.
 */
export function checkoutDeliveryPayload(
  details: CheckoutDetails,
  saved: readonly SavedDeliveryAddress[],
): CheckoutDeliveryPayload | null {
  if (details.choice !== "uk_insured_delivery") return null;
  const chosen =
    details.address === "new" ? null : saved.find((address) => address.id === details.address);
  const source = chosen
    ? {
        recipientName: chosen.recipientName,
        line1: chosen.line1,
        line2: chosen.line2 ?? "",
        city: chosen.city,
        postcode: chosen.postcode,
      }
    : details;
  const line2 = source.line2.trim();
  return {
    deliveryAddress: {
      recipientName: source.recipientName.trim(),
      line1: source.line1.trim(),
      ...(line2 ? { line2 } : {}),
      city: source.city.trim(),
      postcode: normalizeUkPostcode(source.postcode),
      country: "GB",
    },
    deliveryPhone: details.phone.trim(),
    saveAddress: !chosen && details.saveAddress,
  };
}

/** The address part of a delivery quote request, from valid details; the country is the buyer's. */
export function outsideUkDeliveryPayload(details: CheckoutDetails): {
  deliveryAddress: {
    recipientName: string;
    line1: string;
    line2?: string;
    city: string;
    postcode: string;
    country: string;
  };
  deliveryPhone: string;
} {
  const line2 = details.line2.trim();
  return {
    deliveryAddress: {
      recipientName: details.recipientName.trim(),
      line1: details.line1.trim(),
      ...(line2 ? { line2 } : {}),
      city: details.city.trim(),
      postcode: details.postcode.trim(),
      country: details.country.trim().toUpperCase(),
    },
    deliveryPhone: details.phone.trim(),
  };
}
