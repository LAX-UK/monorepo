import { type AdminHomeCoverIssue, SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { ShopApiError } from "./shop-api-error.js";

const SUMMARY: Record<AdminHomeCoverIssue["reason"], string> = {
  picture_unknown: "The picture is not one of the Shop's pictures",
  picture_unreadable: "The picture could not be read",
  picture_too_narrow: "The picture is too small for the cover",
  picture_cannot_carry_type: "The headline cannot be read on this picture",
  alt_missing: "The picture needs alt text",
};

/** A cover refused as a whole; names each field at fault so LAX Admin can mark it. */
export class HomeCoverRejectedError extends ShopApiError {
  readonly issues: readonly AdminHomeCoverIssue[];

  constructor(issues: readonly AdminHomeCoverIssue[]) {
    const first = issues[0];
    super(
      SHOP_API_ERROR_CODES.VALIDATION,
      first ? `${SUMMARY[first.reason]}. Nothing was saved.` : "The cover could not be saved.",
      400,
    );
    this.name = "HomeCoverRejectedError";
    this.issues = issues;
  }

  override responseFields(): Record<string, unknown> {
    return { issues: this.issues };
  }
}
