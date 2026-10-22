import {
  MERCHANDISE_SKU_IN_USE_MESSAGE,
  MERCHANDISE_SLUG_IN_USE_MESSAGE,
  SHOP_API_ERROR_CODES,
} from "@auction/shop-contracts";
import { ShopApiError } from "../errors/shop-api-error.js";
import { pgUniqueViolationConstraint } from "../lib/pg-errors.js";

const MESSAGE_BY_CONSTRAINT: Record<string, string> = {
  shop_product_slug_uid: MERCHANDISE_SLUG_IN_USE_MESSAGE,
  shop_product_variant_sku_uid: MERCHANDISE_SKU_IN_USE_MESSAGE,
};

/**
 * Runs a write and turns a clash on the slug or SKU unique index into a 409 the editor can show
 * against the right field. Anything else is rethrown untouched.
 */
export async function withUniqueValueConflict<T>(write: () => Promise<T>): Promise<T> {
  try {
    return await write();
  } catch (error) {
    const constraint = pgUniqueViolationConstraint(error);
    const message = constraint ? MESSAGE_BY_CONSTRAINT[constraint] : undefined;
    if (message) {
      throw new ShopApiError(SHOP_API_ERROR_CODES.CONFLICT, message, 409);
    }
    throw error;
  }
}
