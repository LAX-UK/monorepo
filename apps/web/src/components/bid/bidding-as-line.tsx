import { type BiddingAccount, biddingAsLabel } from "@/lib/bid/bidding-account";
import { formatPounds } from "@/lib/buyer-agents/authorisation-presenter";
import { cn } from "@auction/ui";
import { Building2, UserRound } from "lucide-react";

type Props = {
  account: BiddingAccount;
  className?: string;
};

/**
 * Names the account a bid is for, "Bidding as Northbank Gallery" or "Bidding as you", with a
 * buyer agent's limit for the sale, so nobody bids from the wrong account by accident.
 */
export function BiddingAsLine({ account, className }: Props) {
  const Icon = account.kind === "organisation" ? Building2 : UserRound;
  const limit =
    account.kind === "organisation" && account.allowed && account.bidLimit != null
      ? account.bidLimit
      : null;
  return (
    <p
      className={cn(
        "flex flex-wrap items-center gap-x-2 gap-y-0.5 font-body text-sm text-on-surface-variant",
        className,
      )}
      data-testid="bidding-as"
    >
      <Icon aria-hidden className="size-4 shrink-0" strokeWidth={1.75} />
      <span className="font-medium text-on-surface">{biddingAsLabel(account)}</span>
      {limit != null ? (
        <span>
          · Your limit for this sale:{" "}
          <span className="font-medium tabular-nums text-on-surface">{formatPounds(limit)}</span>
        </span>
      ) : null}
    </p>
  );
}
