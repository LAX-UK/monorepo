import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { PRINT_CLAIM_MESSAGE, findPrintClaimWord } from "@auction/shop-domain";
import { ShopApiError } from "../../errors/shop-api-error.js";

/**
 * Staff-typed Shop text may not make claims about a print: those belong in the Edition facts,
 * where the shop domain words them. Refuses the save with a plain message.
 */
export function assertNoPrintClaims(
  texts: ReadonlyArray<string | null | undefined>,
  options: { certificateStated?: boolean } = {},
): void {
  for (const text of texts) {
    if (text && findPrintClaimWord(text, options)) {
      throw new ShopApiError(SHOP_API_ERROR_CODES.VALIDATION, PRINT_CLAIM_MESSAGE, 400);
    }
  }
}
