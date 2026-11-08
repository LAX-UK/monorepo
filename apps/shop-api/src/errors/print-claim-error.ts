import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { PRINT_CLAIM_MESSAGE } from "@auction/shop-domain";
import { ShopApiError } from "./shop-api-error.js";

/** Staff text that makes a claim about a print. Names the field at fault, as other form errors do. */
export class PrintClaimError extends ShopApiError {
  readonly field: string;

  constructor(field: string) {
    super(SHOP_API_ERROR_CODES.VALIDATION, PRINT_CLAIM_MESSAGE, 400);
    this.name = "PrintClaimError";
    this.field = field;
  }

  override responseFields(): Record<string, unknown> {
    return { issues: [{ field: this.field, message: this.message }] };
  }
}
