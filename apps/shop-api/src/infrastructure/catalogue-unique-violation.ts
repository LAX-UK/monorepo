import {
  ARTIST_SLUG_IN_USE_MESSAGE,
  ARTWORK_SLUG_IN_USE_MESSAGE,
  SHOP_API_ERROR_CODES,
} from "@auction/shop-contracts";
import { ShopApiError } from "../errors/shop-api-error.js";
import { pgUniqueViolationConstraint } from "../lib/pg-errors.js";

const MESSAGE_BY_CONSTRAINT: Record<string, string> = {
  shop_artwork_slug_uid: ARTWORK_SLUG_IN_USE_MESSAGE,
  shop_artist_slug_uid: ARTIST_SLUG_IN_USE_MESSAGE,
};

/** Turns a clash on an artwork or artist slug into a 409 the editor shows on the slug field. */
export async function withCatalogueSlugConflict<T>(write: () => Promise<T>): Promise<T> {
  try {
    return await write();
  } catch (error) {
    const constraint = pgUniqueViolationConstraint(error);
    const message = constraint ? MESSAGE_BY_CONSTRAINT[constraint] : undefined;
    if (message) throw new ShopApiError(SHOP_API_ERROR_CODES.CONFLICT, message, 409);
    throw error;
  }
}
