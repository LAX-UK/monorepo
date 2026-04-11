import { MaterialIcon } from "@/components/ui/material-icon";
import { formatMoney } from "@/lib/format-currency";
import type { Auction } from "@auction/types";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

function lotNo(id: string): string {
  return id.replace(/-/g, "").slice(0, 6).toUpperCase();
}

type Props = {
  auction: Auction;
  bidPanel: ReactNode;
};

export function ArtworkSplitView({ auction, bidPanel }: Props) {
  const img = auction.images[0];
  const live = auction.status === "active";

  return (
    <main className="flex min-h-screen flex-col lg:flex-row">
      <div className="h-[60vh] w-full overflow-hidden bg-stone-100 lg:sticky lg:top-0 lg:h-screen lg:w-1/2">
        <div className="group relative h-full">
          {img ? (
            <Image
              src={img}
              alt={auction.title}
              fill
              priority
              className="bg-stone-100 object-cover transition-transform duration-1000 group-hover:scale-105 lg:object-contain"
              sizes="50vw"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-secondary">No image</div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-black/5 opacity-0 transition-opacity group-hover:opacity-100" />
        </div>
      </div>
      <div className="w-full overflow-y-auto px-8 pb-20 pt-12 lg:w-1/2 lg:px-24 lg:pt-32">
        <div className="mx-auto max-w-xl lg:mx-0">
          <Link
            href="/"
            className="mb-12 flex items-center gap-2 font-label text-[10px] uppercase tracking-[0.2em] text-secondary transition-colors hover:text-primary"
          >
            <MaterialIcon name="arrow_back" className="text-sm" />
            Back to gallery
          </Link>
          <div className="mb-12">
            <div className="mb-6 flex items-center gap-3">
              {live ? (
                <>
                  <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-error" />
                  <span className="font-label text-[10px] font-bold uppercase tracking-[0.3em] text-error">
                    Live Auction • Lot {lotNo(auction.id)}
                  </span>
                </>
              ) : (
                <span className="font-label text-[10px] font-bold uppercase tracking-[0.3em] text-secondary">
                  {auction.status} • Lot {lotNo(auction.id)}
                </span>
              )}
            </div>
            <h1 className="mb-4 font-headline text-4xl tracking-tight text-on-surface lg:text-6xl">
              {auction.title}
            </h1>
            <p className="mb-10 font-headline text-xl italic text-secondary">
              Seller {auction.sellerId.slice(0, 8)}…
            </p>
            <div className="mb-12 grid grid-cols-2 gap-8 border-y border-stone-200/60 py-8">
              <div>
                <span className="mb-1 block font-label text-[10px] uppercase tracking-widest text-stone-400">
                  Type
                </span>
                <span className="text-sm font-medium">{auction.auctionType}</span>
              </div>
              <div>
                <span className="mb-1 block font-label text-[10px] uppercase tracking-widest text-stone-400">
                  Current
                </span>
                <span className="text-sm font-medium">{formatMoney(auction.currentPrice)}</span>
              </div>
            </div>
            {auction.description ? (
              <p className="font-body text-base leading-relaxed text-on-surface-variant">
                {auction.description}
              </p>
            ) : null}
          </div>
          {bidPanel}
        </div>
      </div>
    </main>
  );
}
