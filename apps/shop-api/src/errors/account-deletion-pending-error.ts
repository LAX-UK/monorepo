import { accountDeletionPendingBody } from "@auction/identity-contracts";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { ShopApiError } from "./shop-api-error.js";

/** A new order refused because the person has asked to delete their account. */
export class AccountDeletionPendingError extends ShopApiError {
  private readonly deletionDueAt: string;

  constructor(requestedAt: Date) {
    const body = accountDeletionPendingBody(requestedAt);
    super(SHOP_API_ERROR_CODES.ACCOUNT_DELETION_PENDING, body.error, 403);
    this.name = "AccountDeletionPendingError";
    this.deletionDueAt = body.deletionDueAt;
  }

  override responseFields(): Record<string, unknown> {
    return { deletionDueAt: this.deletionDueAt };
  }
}
