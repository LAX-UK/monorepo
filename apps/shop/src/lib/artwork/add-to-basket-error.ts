import { type CommerceFailureBody, commerceErrorMessage } from "@/lib/commerce-error-message";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";

export type AddToBasketError = { message: string; signIn: boolean };

/**
 * Why an edition could not be added, shown beside the button. Availability is a state, so a
 * refusal says the edition has sold out and never how many are left; a guest is asked to sign in.
 */
export function addToBasketErrorMessage(body: unknown): AddToBasketError {
  const record = (body && typeof body === "object" ? body : {}) as CommerceFailureBody;
  const { code } = record;
  if (record.error === "sign_in_required" || code === SHOP_API_ERROR_CODES.UNAUTHORIZED) {
    return { message: "Sign in to add this edition to your basket.", signIn: true };
  }
  if (code === SHOP_API_ERROR_CODES.OUT_OF_STOCK) {
    return {
      message: "This edition has just sold out, so it could not be added to your basket.",
      signIn: false,
    };
  }
  if (code === SHOP_API_ERROR_CODES.NOT_FOUND) {
    return { message: "This edition is no longer on sale.", signIn: false };
  }
  return {
    message: commerceErrorMessage(body, "We could not add this edition to your basket. Try again."),
    signIn: false,
  };
}
