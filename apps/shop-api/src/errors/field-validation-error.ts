import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { ShopApiError } from "./shop-api-error.js";

export type FieldIssue = { field: string; message: string };

/**
 * A request refused for what is in its fields, naming each field at fault, so a form can show the
 * message beside the field and in its summary. The message is the first issue's.
 */
export class FieldValidationError extends ShopApiError {
  readonly issues: readonly FieldIssue[];

  constructor(issues: readonly [FieldIssue, ...FieldIssue[]]) {
    super(SHOP_API_ERROR_CODES.VALIDATION, issues[0].message, 400);
    this.name = "FieldValidationError";
    this.issues = issues;
  }

  override responseFields(): Record<string, unknown> {
    return { issues: this.issues };
  }
}
