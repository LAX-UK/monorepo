import { SalesAuctionRow } from "@/components/sections/sales/sales-auction-row";
import type { SaleAuctionRowVM } from "@/components/sections/sales/sales-view-models";
import { cn } from "@auction/ui";

type Props = {
  rows: SaleAuctionRowVM[];
  className?: string;
};

export function SalesAuctionList({ rows, className }: Props) {
  if (rows.length === 0) return null;

  return (
    <ul className={cn("m-0 flex list-none flex-col gap-3 p-0 sm:gap-4 lg:gap-5", className)}>
      {rows.map((vm, index) => (
        <SalesAuctionRow key={vm.id} vm={vm} index={index} />
      ))}
    </ul>
  );
}
