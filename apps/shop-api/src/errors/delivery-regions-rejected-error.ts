import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import type { DeliveryRegionIssue, RestrictedCountryIssue } from "@auction/shop-domain";
import { ShopApiError } from "./shop-api-error.js";

type Issue = DeliveryRegionIssue | RestrictedCountryIssue;

/** A region or the restricted list refused as a whole; names each field or country at fault. */
export class DeliveryRegionsRejectedError extends ShopApiError {
  readonly issues: readonly Issue[];

  constructor(subject: "region" | "countries", issues: readonly Issue[]) {
    super(
      SHOP_API_ERROR_CODES.VALIDATION,
      subject === "region"
        ? "The region could not be saved. Nothing was changed."
        : "The list of countries could not be saved. Nothing was changed.",
      400,
    );
    this.name = "DeliveryRegionsRejectedError";
    this.issues = issues;
  }

  override responseFields(): Record<string, unknown> {
    return { issues: this.issues };
  }
}
