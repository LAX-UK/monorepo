import { SwitchToPersonalButton } from "@/components/bid/switch-to-personal-button";

import {
  type BiddingAccount,
  type MemberBidRefusal,
  biddingAccountOverLimit,
} from "@/lib/bid/bidding-account";
import { formatPounds } from "@/lib/buyer-agents/authorisation-presenter";
import { organisationBidReasonCopy } from "@/lib/presenters/organisation-state/organisation-state-copy";
import type { ReactNode } from "react";
import { blockBid } from "./block-decision";
import type { BidPolicy, BidPolicyContext, BidPolicyDecision } from "./types";

const REFUSAL_DETAIL: Record<MemberBidRefusal, (name: string) => string> = {
  role_cannot_bid: (name) =>
    `Only owners, admins and authorised buyers can bid for ${name}. You can still bid in your own name.`,
  authorisation_required: (name) =>
    `Buyer agents bid for ${name} once an owner or admin authorises them for this sale. Ask them to authorise you, or bid in your own name.`,
  not_member: (name) => `You're no longer a member of ${name}. You can bid in your own name.`,
};

type Refused = Extract<BiddingAccount, { kind: "organisation"; allowed: false }>;

/** The words for a refusal: the organisation's state in its words, or the member's. */
function refusalCopy(account: Refused): { title: string; detail: ReactNode } {
  if (account.reason === "organisation_state") {
    const copy = organisationBidReasonCopy(account.state, { organisationName: account.name });
    const own = account.canSwitchToPersonal ? " You can still bid in your own name." : "";
    // The way to ask us is a link in the sentence, so the panel keeps one button.
    return {
      title: copy.title,
      detail: copy.contact ? (
        <>
          {copy.line}{" "}
          <a
            href={copy.contact.href}
            className="font-medium text-on-surface underline underline-offset-2"
          >
            {copy.contact.label}
          </a>
          .{own}
        </>
      ) : (
        `${copy.line}${own}`
      ),
    };
  }
  return {
    title: `You can't bid for ${account.name}`,
    detail: REFUSAL_DETAIL[account.reason](account.name),
  };
}

/**
 * The active account must be able to bid here. An organisation account that cannot gets a calm
 * explanation before the person tries (its state, such as documents still being checked, or the
 * person's role) and a way back to the personal account, never a disabled form; a buyer agent
 * whose limit is below the next bid is told so before they try.
 */
export const biddingAccountPolicy: BidPolicy = {
  id: "bidding-account",
  evaluate(ctx: BidPolicyContext): BidPolicyDecision {
    const account = ctx.biddingAccount;
    if (!ctx.user || account?.kind !== "organisation") return { kind: "allow" };

    if (!account.allowed) {
      return blockBid("bidding-account-not-allowed", {
        tone: "info",
        ...refusalCopy(account),
        ...(account.canSwitchToPersonal ? { content: <SwitchToPersonalButton /> } : {}),
      });
    }

    if (account.bidLimit != null && biddingAccountOverLimit(account, ctx.minNextBid ?? 0)) {
      return blockBid("bidding-account-over-limit", {
        tone: "info",
        title: "This lot is above your limit",
        detail: `Your limit for this sale is ${formatPounds(account.bidLimit)}. Ask an owner or admin of ${account.name} to raise it, or bid in your own name.`,
        content: <SwitchToPersonalButton />,
      });
    }

    return { kind: "allow" };
  },
};
