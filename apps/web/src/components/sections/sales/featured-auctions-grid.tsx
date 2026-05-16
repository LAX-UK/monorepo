import { FeaturedAuctionCard } from "@/components/sections/sales/featured-auction-card";
import type { FeaturedAuctionCardVM } from "@/components/sections/sales/sales-view-models";

type Props = {
  vms: FeaturedAuctionCardVM[];
};

/** Featured row — mobile-first grid, 1 / 2 / 3 columns. */
export function FeaturedAuctionsGrid({ vms }: Props) {
  if (vms.length === 0) return null;

  return (
    <ul className="m-0 grid w-full list-none grid-cols-2 gap-2 p-0 md:grid-cols-2 md:gap-4 xl:grid-cols-3 xl:gap-4">
      {vms.map((vm, index) => (
        <FeaturedAuctionCard key={vm.id} vm={vm} index={index} />
      ))}
    </ul>
  );
}
