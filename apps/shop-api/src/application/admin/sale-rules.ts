import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { ShopApiError } from "../../errors/shop-api-error.js";

/**
 * A fee is approved by someone other than the person who created it. Fees created before the
 * creator was recorded have none, and anyone with the capability can approve them.
 */
export function assertSaleFeeCanBeApproved(input: {
  status: string;
  createdBySubjectId: string | null;
  actorSubjectId: string;
}): void {
  if (input.status !== "pending") {
    throw new ShopApiError(SHOP_API_ERROR_CODES.CONFLICT, "Sale fee is not pending approval", 409);
  }
  if (input.createdBySubjectId !== null && input.createdBySubjectId === input.actorSubjectId) {
    throw new ShopApiError(
      SHOP_API_ERROR_CODES.STAFF_FORBIDDEN,
      "A fee cannot be approved by the person who created it",
      403,
    );
  }
}

export function assertThirdPartySaleParties(input: {
  sellerPartyId: string;
  buyerPartyId: string;
}): void {
  if (input.sellerPartyId === input.buyerPartyId) {
    throw new ShopApiError(
      SHOP_API_ERROR_CODES.VALIDATION,
      "Seller and buyer must be different parties",
      400,
    );
  }
}

/** Only an edition authorised for sale and not held, reserved or sold can be sold. */
export function assertEditionAvailableForThirdPartySale(listingStatus: string): void {
  if (listingStatus !== "authorised") {
    throw new ShopApiError(SHOP_API_ERROR_CODES.CONFLICT, "Edition is not available for sale", 409);
  }
}
