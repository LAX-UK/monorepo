import { FeaturedAuctionCard } from "@/components/sections/sales/featured-auction-card";
import type { FeaturedAuctionCardVM } from "@/components/sections/sales/sales-view-models";

type Props = {
  vms: FeaturedAuctionCardVM[];
};

/** Three-up featured row — `calendar.html` trending section (gap 16px, flex). */
export function FeaturedAuctionsGrid({ vms }: Props) {
  if (vms.length === 0) return null;

  return (
    <ul className="m-0 flex w-full list-none flex-col gap-4 p-0 sm:flex-row sm:gap-4 lg:gap-4">
      {vms.map((vm, index) => (
        <FeaturedAuctionCard key={vm.id} vm={vm} index={index} />
      ))}
    </ul>
  );
}
