import { commerceErrorMessage } from "@/lib/commerce-error-message";
import { SHOP_API_ERROR_CODES, parseDeliveryQuoteRequestResult } from "@auction/shop-contracts";
import type { CheckoutFieldErrors } from "./checkout-details";

/** What the buyer sees after asking for a delivery quote. */
export type DeliveryQuoteStartResult =
  /** The print is held until `holdUntil` while we quote the delivery. */
  | {
      kind: "quote_requested";
      orderReference: string;
      holdUntil: string;
      country: string;
      regionId: "eu" | "north_america" | "asia_pacific" | null;
    }
  /** The region has a fixed rate: payment opens now. */
  | { kind: "pay"; checkoutUrl: string }
  /** A country the Shop does not deliver to; collection is offered instead. */
  | { kind: "not_delivered"; country: string }
  /** The address needs another look: each field named. */
  | { kind: "fields"; errors: CheckoutFieldErrors }
  | { kind: "sign_in_required" }
  | { kind: "error"; message: string };

const FIELD_MESSAGES: Record<string, Record<string, string>> = {
  recipientName: { required: "Enter the full name of the person receiving the delivery" },
  line1: { required: "Enter the first line of the address" },
  city: { required: "Enter a town or city" },
  postcode: {
    required: "Enter a postal code",
    too_long: "Enter a shorter postal code",
  },
  country: {
    required: "Choose the country",
    unknown_country: "Choose a country from the list",
    united_kingdom: "Choose UK insured delivery for an address in the United Kingdom",
  },
  phone: {
    required: "Enter a phone number for the courier",
    invalid_phone: "Enter a phone number with the country code, like +49 30 1234567",
  },
};

/** The address problems the shop API named, said against each field. */
export function quoteIssueErrors(issues: unknown): CheckoutFieldErrors {
  const errors: CheckoutFieldErrors = {};
  if (!Array.isArray(issues)) return errors;
  for (const issue of issues) {
    const { field, reason } = (issue ?? {}) as { field?: string; reason?: string };
    const message = field && reason ? FIELD_MESSAGES[field]?.[reason] : undefined;
    if (message && field && !(field in errors)) {
      errors[(field === "phone" ? "phone" : field) as keyof CheckoutFieldErrors] = message;
    }
  }
  return errors;
}

const GENERIC = "We could not send your request. Review your basket and try again.";

/** Reads the answer to a delivery quote request, whichever way it was asked. */
export function deliveryQuoteStartResult(status: number, body: unknown): DeliveryQuoteStartResult {
  if (status === 200) {
    try {
      const result = parseDeliveryQuoteRequestResult(body);
      if (result.outcome === "pay_now") return { kind: "pay", checkoutUrl: result.checkoutUrl };
      if (result.outcome === "not_delivered") {
        return { kind: "not_delivered", country: result.country };
      }
      return {
        kind: "quote_requested",
        orderReference: result.orderReference,
        holdUntil: result.holdUntil,
        country: result.country,
        regionId: result.regionId,
      };
    } catch {
      return { kind: "error", message: "We got an unexpected answer. Try again shortly." };
    }
  }
  const record = (body && typeof body === "object" ? body : {}) as {
    code?: string;
    message?: string;
    issues?: unknown;
  };
  if (record.code === SHOP_API_ERROR_CODES.ACCOUNT_EXISTS) return { kind: "sign_in_required" };
  if (status === 400) {
    const errors = quoteIssueErrors(record.issues);
    if (Object.keys(errors).length > 0) return { kind: "fields", errors };
  }
  // A cap on open requests is worded for the buyer by the server; show it as written.
  if (status === 409 && record.code === SHOP_API_ERROR_CODES.CONFLICT && record.message) {
    return { kind: "error", message: record.message };
  }
  if (status === 429) {
    return { kind: "error", message: "Too many attempts. Wait a few minutes and try again." };
  }
  return { kind: "error", message: commerceErrorMessage(body, GENERIC) };
}
