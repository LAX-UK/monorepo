import { FeaturedAuctionCard } from "@/components/sections/sales/featured-auction-card";
import type { FeaturedAuctionCardVM } from "@/components/sections/sales/sales-view-models";
import { sparseGridClasses } from "@/lib/ui/sparse-grid-classes";
import { cn } from "@auction/ui";

type Props = {
  vms: FeaturedAuctionCardVM[];
};

/** Featured row — mobile-first grid, 1 / 2 / 3 columns. */
export function FeaturedAuctionsGrid({ vms }: Props) {
  if (vms.length === 0) return null;

  return (
    <ul
      className={cn(
        "m-0 w-full list-none gap-2 p-0 md:gap-4 xl:gap-4",
        sparseGridClasses(vms.length, {
          multi: "grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-2 xl:grid-cols-3",
        }),
      )}
    >
      {vms.map((vm, index) => (
        <FeaturedAuctionCard key={vm.id} vm={vm} index={index} />
      ))}
    </ul>
  );
}
