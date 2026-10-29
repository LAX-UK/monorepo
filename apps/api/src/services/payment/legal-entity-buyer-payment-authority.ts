import { type PaymentAuthorityDecision, buyerPaymentAuthority } from "@auction/domain";
import type { ILegalEntityRepository } from "@auction/persistence/interfaces";
import type {
  IBuyerPaymentAuthority,
  PaymentActor,
  PaymentAuthorityLot,
} from "../interfaces/buyer-payment-authority.js";

type AccountReader = Pick<ILegalEntityRepository, "findById" | "findActiveMembership">;

/**
 * Answers {@link IBuyerPaymentAuthority} from the account the lot was won for and the payer's
 * active membership of it. A removed member has no active membership, so they are refused.
 */
export class LegalEntityBuyerPaymentAuthority implements IBuyerPaymentAuthority {
  constructor(private readonly accounts: AccountReader) {}

  async canPay(actor: PaymentActor, lot: PaymentAuthorityLot): Promise<PaymentAuthorityDecision> {
    if (!lot.winnerId || !lot.buyerLegalEntityId) {
      return { allowed: false, reason: "lot_not_won" };
    }
    const [account, membership] = await Promise.all([
      this.accounts.findById(lot.buyerLegalEntityId),
      this.accounts.findActiveMembership(actor.userId, lot.buyerLegalEntityId),
    ]);
    if (!account) return { allowed: false, reason: "not_member" };
    return buyerPaymentAuthority({
      payerUserId: actor.userId,
      lot: { winnerId: lot.winnerId, buyerAccountKind: account.kind },
      membership: membership
        ? { role: membership.role, isImpersonation: membership.isImpersonation }
        : null,
    });
  }
}
