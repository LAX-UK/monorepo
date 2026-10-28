import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import type { HomeFeatureIssue } from "@auction/shop-domain";
import { ShopApiError } from "./shop-api-error.js";

const SUMMARY: Record<HomeFeatureIssue["reason"], string> = {
  unknown: "no longer exists",
  duplicate: "is in the list twice",
  not_a_shop_edition: "is not a Shop edition",
  over_limit: "is past the list's limit",
};

/** A featured list refused as a whole; names each row at fault so LAX Admin can mark it. */
export class HomeFeaturesRejectedError extends ShopApiError {
  readonly issues: readonly HomeFeatureIssue[];

  constructor(issues: readonly HomeFeatureIssue[]) {
    const first = issues[0];
    super(
      SHOP_API_ERROR_CODES.VALIDATION,
      first
        ? `Row ${first.index + 1} ${SUMMARY[first.reason]}${issues.length > 1 ? `, and ${issues.length - 1} more` : ""}. Nothing was saved.`
        : "The list could not be saved.",
      400,
    );
    this.name = "HomeFeaturesRejectedError";
    this.issues = issues;
  }

  override responseFields(): Record<string, unknown> {
    return { issues: this.issues };
  }
}
