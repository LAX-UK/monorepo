import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import type { DeliveryQuoteInputIssue } from "@auction/shop-domain";
import { ShopApiError } from "./shop-api-error.js";

export type StaffQuoteIssue =
  | DeliveryQuoteInputIssue
  | { field: "note"; reason: "required" | "too_long" };

/** A quote or a decline refused because a field needs another look; names each one. */
export class DeliveryQuoteStaffRejectedError extends ShopApiError {
  readonly issues: readonly StaffQuoteIssue[];

  constructor(issues: readonly StaffQuoteIssue[]) {
    super(SHOP_API_ERROR_CODES.VALIDATION, "The quote could not be saved. Nothing was sent.", 400);
    this.name = "DeliveryQuoteStaffRejectedError";
    this.issues = issues;
  }

  override responseFields(): Record<string, unknown> {
    return { issues: this.issues };
  }
}
