import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import type { OutsideUkAddressIssue } from "@auction/shop-domain";
import { ShopApiError } from "./shop-api-error.js";

/** A delivery quote request refused because the address needs another look; names each field. */
export class DeliveryQuoteRequestRejectedError extends ShopApiError {
  readonly issues: readonly OutsideUkAddressIssue[];

  constructor(issues: readonly OutsideUkAddressIssue[]) {
    super(
      SHOP_API_ERROR_CODES.VALIDATION,
      "The delivery address needs another look. Nothing was sent.",
      400,
    );
    this.name = "DeliveryQuoteRequestRejectedError";
    this.issues = issues;
  }

  override responseFields(): Record<string, unknown> {
    return { issues: this.issues };
  }
}
