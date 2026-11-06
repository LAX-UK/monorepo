import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import {
  STORY_COVER_REQUIRED_FIELD,
  STORY_COVER_REQUIRED_MESSAGES,
  type StoryCoverViolation,
} from "../domain/editorial-story-cover-rule.js";
import { ShopApiError } from "./shop-api-error.js";

/** A story without a cover image cannot be published or featured. Names the field at fault. */
export class StoryCoverRequiredError extends ShopApiError {
  readonly violation: StoryCoverViolation;

  constructor(violation: StoryCoverViolation) {
    super(SHOP_API_ERROR_CODES.STORY_COVER_REQUIRED, STORY_COVER_REQUIRED_MESSAGES[violation], 400);
    this.name = "StoryCoverRequiredError";
    this.violation = violation;
  }

  override responseFields(): Record<string, unknown> {
    return { issues: [{ field: STORY_COVER_REQUIRED_FIELD, message: this.message }] };
  }
}
