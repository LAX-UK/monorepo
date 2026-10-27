import { SwitchToPersonalButton } from "@/components/bid/switch-to-personal-button";
import { type BiddingAccountRefusal, biddingAccountOverLimit } from "@/lib/bid/bidding-account";
import { formatPounds } from "@/lib/buyer-agents/authorisation-presenter";
import { blockBid } from "./block-decision";
import type { BidPolicy, BidPolicyContext, BidPolicyDecision } from "./types";

const REFUSAL_DETAIL: Record<BiddingAccountRefusal, (name: string) => string> = {
  role_cannot_bid: (name) =>
    `Only owners, admins and authorised buyers can bid for ${name}. You can still bid in your own name.`,
  authorisation_required: (name) =>
    `Buyer agents bid for ${name} once an owner or admin authorises them for this sale. Ask them to authorise you, or bid in your own name.`,
  not_member: (name) => `You're no longer a member of ${name}. You can bid in your own name.`,
};

/**
 * The active account must be able to bid here. An organisation account that cannot gets a calm
 * explanation and a way back to the personal account, never a disabled form; a buyer agent
 * whose limit is below the next bid is told so before they try.
 */
export const biddingAccountPolicy: BidPolicy = {
  id: "bidding-account",
  evaluate(ctx: BidPolicyContext): BidPolicyDecision {
    const account = ctx.biddingAccount;
    if (!ctx.user || account?.kind !== "organisation") return { kind: "allow" };

    if (!account.allowed) {
      return blockBid("bidding-account-not-allowed", {
        tone: "neutral",
        title: `You can't bid for ${account.name}`,
        detail: REFUSAL_DETAIL[account.reason](account.name),
        ...(account.canSwitchToPersonal ? { content: <SwitchToPersonalButton /> } : {}),
      });
    }

    if (account.bidLimit != null && biddingAccountOverLimit(account, ctx.minNextBid ?? 0)) {
      return blockBid("bidding-account-over-limit", {
        tone: "neutral",
        title: "This lot is above your limit",
        detail: `Your limit for this sale is ${formatPounds(account.bidLimit)}. Ask an owner or admin of ${account.name} to raise it, or bid in your own name.`,
        content: <SwitchToPersonalButton />,
      });
    }

    return { kind: "allow" };
  },
};
