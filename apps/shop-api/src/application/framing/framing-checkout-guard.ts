import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { ShopApiError } from "../../errors/shop-api-error.js";

/**
 * Framing is not priced into an order yet, so a basket holding a framed print cannot be paid for:
 * it would be charged without its frame. This stands until orders carry framing as a line of their
 * own; it can then be removed.
 */
export function assertNoFramingInOrder(
  lines: readonly { framingOptionId?: string | null | undefined }[],
): void {
  if (lines.some((line) => line.framingOptionId != null)) {
    throw new ShopApiError(
      SHOP_API_ERROR_CODES.FEATURE_DISABLED,
      "Framing cannot be ordered yet",
      409,
    );
  }
}
