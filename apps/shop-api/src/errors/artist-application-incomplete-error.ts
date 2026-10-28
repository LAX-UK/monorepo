import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import type { ArtistApplicationBlocker } from "@auction/shop-domain";
import { ShopApiError } from "./shop-api-error.js";

/** A submit refused because answers are missing; lists each one with the step that fixes it. */
export class ArtistApplicationIncompleteError extends ShopApiError {
  readonly blockers: readonly ArtistApplicationBlocker[];

  constructor(blockers: readonly ArtistApplicationBlocker[]) {
    super(SHOP_API_ERROR_CODES.VALIDATION, "Some answers are missing", 400);
    this.name = "ArtistApplicationIncompleteError";
    this.blockers = blockers;
  }

  override responseFields(): Record<string, unknown> {
    return { blockers: this.blockers };
  }
}
