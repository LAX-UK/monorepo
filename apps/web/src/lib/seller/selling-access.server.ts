import "server-only";

import {
  type SellerWorkspaceContext,
  sellerCan,
  sellerCanStartSubmission,
} from "@/lib/legal-entity/seller-acting-context.server";

export type SellingAccess = {
  /** The organisation's name, or `null` for a person's own account. */
  organisation: string | null;
  /** The member may start a work to sell, and the account's state allows it. */
  canSell: boolean;
  /**
   * Why selling is held: the member's role sells, but the organisation's state does not allow
   * it now. Steps stay in view, disabled, with this reason.
   */
  pausedReason: string | null;
};

/** What the selling pages offer the member, from their role and the account's state. */
export function sellingAccess(ctx: SellerWorkspaceContext): SellingAccess {
  const account = ctx.sellingAsOrganisation
    ? (ctx.memberships.find((membership) => membership.id === ctx.sellerEntityId) ?? null)
    : null;
  const organisation = account?.displayName ?? null;
  const canSell = sellerCanStartSubmission(ctx);
  const roleSells = sellerCan(ctx, "entity.submissions.create");
  return {
    organisation,
    canSell,
    pausedReason:
      organisation && roleSells && !canSell ? `Paused until we hear from ${organisation}.` : null,
  };
}
