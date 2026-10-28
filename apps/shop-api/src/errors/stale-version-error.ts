import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { ShopApiError } from "./shop-api-error.js";

/**
 * A save was refused because the row changed after the editor opened it. Carries the row's
 * current version so the editor can offer to reload or to save over it.
 */
export class StaleVersionError extends ShopApiError {
  readonly currentVersion: string;

  constructor(label: string, currentVersion: string) {
    super(
      SHOP_API_ERROR_CODES.CONFLICT,
      `${label} was changed by someone else since it was opened`,
      409,
    );
    this.name = "StaleVersionError";
    this.currentVersion = currentVersion;
  }

  override responseFields(): Record<string, unknown> {
    return { currentVersion: this.currentVersion };
  }
}
