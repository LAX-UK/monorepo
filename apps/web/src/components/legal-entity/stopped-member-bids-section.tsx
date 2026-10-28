import type { StoppedMemberBidsRow } from "@/lib/data/http/organisation-membership.types";
import { formatDate, formatMoney } from "@/lib/ui/format";
import { Surface } from "@auction/ui/components/surface";

type Props = {
  entityName: string;
  stopped: readonly StoppedMemberBidsRow[];
};

const KIND_LABEL: Record<StoppedMemberBidsRow["bids"][number]["kind"], string> = {
  auto_bid: "Automatic bid",
  absentee: "Absentee bid",
};

function lotName(bid: StoppedMemberBidsRow["bids"][number]): string {
  return bid.lotNumber != null ? `Lot ${bid.lotNumber} · ${bid.lotTitle}` : bid.lotTitle;
}

/**
 * The automatic bids that stopped when members left, for review: nothing to do here, but the
 * people who run the organisation can see what will no longer bid for it.
 */
export function StoppedMemberBidsSection({ entityName, stopped }: Props) {
  if (stopped.length === 0) return null;
  return (
    <Surface
      id="stopped-member-bids"
      variant="section"
      padding="none"
      className="scroll-mt-24 overflow-hidden p-0 sm:p-0"
      aria-labelledby="stopped-member-bids-heading"
    >
      <div className="space-y-1 p-4 sm:px-5 sm:pt-5">
        <h3
          id="stopped-member-bids-heading"
          className="font-headline text-base font-semibold text-on-surface"
        >
          Automatic bids stopped when members left
        </h3>
        <p className="font-body text-sm text-on-surface-variant">
          When someone leaves {entityName}, their automatic and absentee bids for it stop. Bids they
          already placed stay in the sale. Shown for 30 days.
        </p>
      </div>
      <ul className="divide-y divide-border-hairline border-t border-border-hairline">
        {stopped.map((group) => (
          <li
            key={`${group.memberUserId}:${group.stoppedAt}`}
            className="space-y-2 p-4 sm:px-5"
            data-testid={`stopped-bids-${group.memberUserId}`}
          >
            <p className="font-body text-sm font-semibold text-on-surface">
              {group.memberName}{" "}
              <span className="font-normal text-on-surface-variant">
                · left {formatDate(group.stoppedAt)}
              </span>
            </p>
            <ul className="space-y-1">
              {group.bids.map((bid) => (
                <li
                  key={`${bid.kind}:${bid.lotId}`}
                  className="font-body text-sm text-on-surface-variant"
                >
                  <span className="text-on-surface">{lotName(bid)}</span> · {KIND_LABEL[bid.kind]}{" "}
                  up to {formatMoney(bid.maxAmount)}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </Surface>
  );
}
