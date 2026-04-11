import { PastAuctionCard } from "@/components/sections/archive/past-auction-card";
import type { Auction } from "@auction/types";

export type ArchiveLotVM = {
  auction: Auction;
  sellerName: string;
};

const OFFSET_PATTERN = ["", "lg:mt-16", "", "md:-mt-8", "lg:mt-24", ""] as const;

type Props = {
  items: ArchiveLotVM[];
};

export function PastAuctionsGrid({ items }: Props) {
  if (items.length === 0) {
    return (
      <p className="mx-auto max-w-screen-2xl font-body text-on-surface-variant">
        No past auctions match these filters.
      </p>
    );
  }

  return (
    <section className="mx-auto grid max-w-screen-2xl grid-cols-1 gap-x-12 gap-y-24 md:grid-cols-2 lg:grid-cols-3">
      {items.map((row, i) => (
        <PastAuctionCard
          key={row.auction.id}
          auction={row.auction}
          sellerName={row.sellerName}
          gridOffsetClass={OFFSET_PATTERN[i % OFFSET_PATTERN.length] ?? ""}
        />
      ))}
    </section>
  );
}
