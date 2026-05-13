import { SalesAuctionRow } from "@/components/sections/sales/sales-auction-row";
import type { SaleAuctionRowVM } from "@/components/sections/sales/sales-view-models";

type Props = {
  rows: SaleAuctionRowVM[];
};

export function SalesAuctionList({ rows }: Props) {
  if (rows.length === 0) return null;

  return (
    <ul className="m-0 list-none p-0">
      {rows.map((vm, index) => (
        <SalesAuctionRow key={vm.id} vm={vm} index={index} />
      ))}
    </ul>
  );
}
