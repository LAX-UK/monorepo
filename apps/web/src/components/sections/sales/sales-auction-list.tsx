import { SalesAuctionRow } from "@/components/sections/sales/sales-auction-row";
import type { SaleAuctionRowVM } from "@/components/sections/sales/sales-view-models";

type Props = {
  rows: SaleAuctionRowVM[];
};

export function SalesAuctionList({ rows }: Props) {
  if (rows.length === 0) return null;

  return (
    <ul className="m-0 flex list-none flex-col gap-3 p-0 sm:gap-4 lg:gap-5">
      {rows.map((vm, index) => (
        <SalesAuctionRow key={vm.id} vm={vm} index={index} />
      ))}
    </ul>
  );
}
