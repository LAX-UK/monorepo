import { resolveLotAuctionTypePresentation } from "@/lib/presenters/lot-auction-type-presentation";
import type { LotAuctionType } from "@auction/types";
import { LotAuctionTypePill } from "@auction/ui";

type Props = {
  auctionType: LotAuctionType;
  className?: string;
  iconOnly?: boolean;
};

/** Staff lot auction-type chip — registry → Tag-Review pill. */
export function LotAuctionTypeChip({ auctionType, className, iconOnly }: Props) {
  const presentation = resolveLotAuctionTypePresentation(auctionType);
  return (
    <LotAuctionTypePill
      mode={presentation.mode}
      label={presentation.label}
      {...(className ? { className } : {})}
      {...(iconOnly ? { iconOnly } : {})}
    />
  );
}
