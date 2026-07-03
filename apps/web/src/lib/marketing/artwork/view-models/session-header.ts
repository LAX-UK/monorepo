import type { Lot, PublicLotView } from "@auction/types";

/** Top session bar for online auction layout. */
export type AuctionSessionHeaderVM = {
  saleTitle: string;
  lotLabel: string;
  paddleNumber: string | null;
  userVerified: boolean;
};

export function mapAuctionSessionHeaderVM(args: {
  saleTitle: string;
  lot: Lot | PublicLotView;
  paddleNumber?: string | null;
  userVerified?: boolean;
}): AuctionSessionHeaderVM {
  const lotNo =
    args.lot.lotNumber != null
      ? args.lot.lotNumber
      : args.lot.id.replace(/-/g, "").slice(0, 4).toUpperCase();
  return {
    saleTitle: args.saleTitle,
    lotLabel: `Lot ${lotNo} — ${args.lot.title}`,
    paddleNumber: args.paddleNumber ?? null,
    userVerified: args.userVerified ?? false,
  };
}
