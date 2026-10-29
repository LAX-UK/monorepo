import type { IBuyerPaymentAuthority } from "../services/interfaces/buyer-payment-authority.js";

/**
 * A payment authority for tests about checkout itself rather than who pays: the winner may pay,
 * nobody else. Who pays an organisation's purchase is covered by the authority's own tests.
 */
export const winnerPaysForTests: IBuyerPaymentAuthority = {
  canPay: async (actor, lot) => {
    if (!lot.winnerId) return { allowed: false, reason: "lot_not_won" };
    return lot.winnerId === actor.userId
      ? { allowed: true }
      : { allowed: false, reason: "not_winner" };
  },
};
