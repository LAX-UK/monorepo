import { PastAuctionCard } from "@/components/sections/archive/past-auction-card";
import type { Lot } from "@auction/types";
import Link from "next/link";

export type ArchiveLotVM = {
  auction: Lot;
  sellerName: string;
};

const OFFSET_PATTERN = ["", "lg:mt-16", "", "md:-mt-8", "lg:mt-24", ""] as const;

type Props = {
  items: ArchiveLotVM[];
  currentUserId?: string | null;
};

export function PastAuctionsGrid({ items, currentUserId = null }: Props) {
  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-screen-2xl rounded-xl border border-outline-variant/15 bg-surface-container-low/50 px-8 py-12 text-center ring-1 ring-outline-variant/10">
        <p className="mb-6 font-body text-on-surface-variant">
          No past auctions match these filters.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/archive"
            className="inline-flex items-center justify-center border-b-2 border-primary pb-1 font-label text-xs font-bold uppercase tracking-widest text-primary transition-opacity hover:opacity-80"
          >
            View full archive
          </Link>
          <span className="hidden text-on-surface-variant sm:inline" aria-hidden>
            ·
          </span>
          <Link
            href="/"
            className="inline-flex items-center justify-center font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant underline-offset-4 transition-colors hover:text-primary hover:underline"
          >
            Back to upcoming auctions
          </Link>
        </div>
      </div>
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
          isOwner={Boolean(currentUserId && row.auction.sellerId === currentUserId)}
        />
      ))}
    </section>
  );
}
