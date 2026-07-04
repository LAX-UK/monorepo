import type { IAccountDeletionEligibilityReader } from "@auction/persistence/interfaces";

export type AccountDeletionEligibilityResult =
  | { ok: true }
  | {
      ok: false;
      code:
        | "account_deletion_already_requested"
        | "account_deletion_pending_payments"
        | "account_deletion_active_seller_lots"
        | "account_deletion_open_payouts";
      error: string;
    };

export class AccountDeletionEligibilityService {
  constructor(private readonly reader: IAccountDeletionEligibilityReader) {}

  async check(userId: string): Promise<AccountDeletionEligibilityResult> {
    const deletionRequestedAt = await this.reader.getDeletionRequestedAt(userId);
    if (deletionRequestedAt) {
      return {
        ok: false,
        code: "account_deletion_already_requested",
        error: "Deletion already requested",
      };
    }

    if (await this.reader.hasPendingPayment(userId)) {
      return {
        ok: false,
        code: "account_deletion_pending_payments",
        error: "You have unpaid pending payments; resolve them before deleting your account.",
      };
    }

    if (await this.reader.hasActiveSellerLot(userId)) {
      return {
        ok: false,
        code: "account_deletion_active_seller_lots",
        error:
          "You still have active or scheduled lots as a seller; withdraw or complete them first.",
      };
    }

    const entityIds = await this.reader.listActiveMembershipEntityIds(userId);
    if (await this.reader.hasOpenPayoutForEntities(entityIds)) {
      return {
        ok: false,
        code: "account_deletion_open_payouts",
        error: "Your organisation has payouts still in flight; resolve them before deletion.",
      };
    }

    return { ok: true };
  }
}
