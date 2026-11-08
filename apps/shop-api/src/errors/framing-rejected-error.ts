import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import type { FramingIssue, FramingIssueReason } from "@auction/shop-domain";
import { ShopApiError } from "./shop-api-error.js";

const SUMMARY: Record<FramingIssueReason, string> = {
  name_required: "needs a name",
  name_too_long: "has a name that is too long",
  lead_time_min_invalid: "needs a shortest lead time",
  lead_time_max_invalid: "needs a longest lead time",
  lead_time_order: "has a longest lead time shorter than the shortest",
  price_missing: "needs a price for every size",
  price_invalid: "has a price that is not allowed",
  placeholder_prices: "still has placeholder prices, so it cannot be offered",
};

/** A framing option refused as a whole; names every field at fault so LAX Admin can mark each. */
export class FramingRejectedError extends ShopApiError {
  readonly issues: readonly FramingIssue[];

  constructor(issues: readonly FramingIssue[]) {
    const first = issues[0];
    super(
      SHOP_API_ERROR_CODES.VALIDATION,
      first
        ? `The framing option ${SUMMARY[first.reason]}${issues.length > 1 ? `, and ${issues.length - 1} more thing${issues.length > 2 ? "s" : ""} to fix` : ""}. Nothing was saved.`
        : "The framing option could not be saved.",
      400,
    );
    this.name = "FramingRejectedError";
    this.issues = issues;
  }

  override responseFields(): Record<string, unknown> {
    return { issues: this.issues };
  }
}
