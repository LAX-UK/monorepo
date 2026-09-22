import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";

export type CommerceFailureBody = {
  error?: string;
  code?: string;
  message?: string;
};

export function commerceErrorMessage(body: unknown, fallback: string): string {
  if (!body || typeof body !== "object") return fallback;
  const record = body as CommerceFailureBody;
  if (record.error === "csrf_failed") {
    return "Your session expired. Refresh the page and try again.";
  }
  if (record.error === "sign_in_required") {
    return "Sign in to continue.";
  }
  if (record.error === "identity_token_unavailable") {
    return "Sign-in services are temporarily unavailable. Try again shortly.";
  }
  if (record.error === "invalid_upstream") {
    return "Shop services returned an unexpected response. Try again shortly.";
  }
  if (record.error === "validation_failed") {
    return "Check your details and try again.";
  }
  if (record.error === "commerce_upstream_failed" && record.code) {
    return commerceErrorMessage({ code: record.code, message: record.message }, fallback);
  }
  const code = record.code;
  switch (code) {
    case SHOP_API_ERROR_CODES.OUT_OF_STOCK:
      return "This edition is no longer available in the quantity requested.";
    case SHOP_API_ERROR_CODES.PRICE_CHANGED:
      return "The price changed. Refresh your basket and try again.";
    case SHOP_API_ERROR_CODES.BASKET_CONFLICT:
      return "Your basket changed on another device. Refresh and try again.";
    case SHOP_API_ERROR_CODES.NOT_FOUND:
      return "We could not find that item. It may have been removed.";
    case SHOP_API_ERROR_CODES.CONFLICT:
      return "This work is not accepting availability notifications right now.";
    case SHOP_API_ERROR_CODES.VALIDATION:
      return "Check your details and try again.";
    case SHOP_API_ERROR_CODES.INTERNAL:
      return "Something went wrong on our side. Try again shortly.";
    case SHOP_API_ERROR_CODES.PAYMENT_FAILED:
      return "Payment could not be completed. Try again or use another method.";
    case SHOP_API_ERROR_CODES.UNAUTHORIZED:
    case SHOP_API_ERROR_CODES.FORBIDDEN:
      return "Sign in to continue.";
    default:
      if (typeof record.message === "string" && record.message.trim().length > 0) {
        return record.message;
      }
      return fallback;
  }
}
