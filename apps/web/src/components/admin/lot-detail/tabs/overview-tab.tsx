import { AdminLotOverviewPanel } from "@/components/admin/admin-lot-overview-panel";
import type { LotDetailContext } from "@/lib/admin/lot-detail-context";
import type { Lot } from "@auction/types";

type Props = {
  lotId: string;
  auction: Lot;
  context: LotDetailContext;
  bidCount: number | null;
};

export function LotOverviewTab({ lotId, auction, context, bidCount }: Props) {
  const imageAlts = auction.marketingDetails.imageAlts ?? [];

  return (
    <AdminLotOverviewPanel
      lotId={lotId}
      auction={auction}
      imageAlts={imageAlts.filter(Boolean) as string[]}
      context={context}
      bidCount={bidCount}
    />
  );
}
