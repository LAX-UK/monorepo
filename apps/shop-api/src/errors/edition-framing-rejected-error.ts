import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import type { EditionFramingIssue, EditionFramingIssueReason } from "@auction/shop-domain";
import { ShopApiError } from "./shop-api-error.js";

const SUMMARY: Record<EditionFramingIssueReason, string> = {
  framed_only_needs_option: "is sold framed only, so it needs an option buyers can choose",
  description_required: "needs the artist's frame described",
  description_too_long: "has a description of the artist's frame that is too long",
  offers_not_allowed: "comes framed by the artist, so it offers no options",
  no_size_band: "needs a sheet size of up to 80 × 100 cm on the Edition tab to offer options",
  option_not_offerable: "offers an option that buyers cannot be shown yet",
  option_listed_twice: "lists an option twice",
  override_invalid: "has a price for this edition that is not allowed",
};

/** An edition's framing refused as a whole; names each field at fault so LAX Admin can mark it. */
export class EditionFramingRejectedError extends ShopApiError {
  readonly issues: readonly EditionFramingIssue[];

  constructor(issues: readonly EditionFramingIssue[]) {
    const first = issues[0];
    super(
      SHOP_API_ERROR_CODES.VALIDATION,
      first
        ? `This edition's framing ${SUMMARY[first.reason]}${issues.length > 1 ? `, and ${issues.length - 1} more thing${issues.length > 2 ? "s" : ""} to fix` : ""}. Nothing was saved.`
        : "This edition's framing could not be saved.",
      400,
    );
    this.name = "EditionFramingRejectedError";
    this.issues = issues;
  }

  override responseFields(): Record<string, unknown> {
    return { issues: this.issues };
  }
}
