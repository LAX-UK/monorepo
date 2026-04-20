import { formatMoney } from "@/lib/format-currency";
import { TINY_IMAGE_BLUR } from "@/lib/image-blur";
import type { Lot } from "@auction/types";
import Image from "next/image";
import Link from "next/link";

function lotNo(id: string): string {
  return id.replace(/-/g, "").slice(0, 6).toUpperCase();
}

function closingCaption(endTime: Date): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(endTime);
}

type Props = {
  auction: Lot;
  sellerName: string;
  gridOffsetClass?: string;
};

export function PastAuctionCard({ auction, sellerName, gridOffsetClass = "" }: Props) {
  const img = auction.images[0];
  return (
    <div className={`group ${gridOffsetClass}`}>
      <Link href={`/artwork/${auction.id}`} className="block">
        <div className="relative mb-8 aspect-[4/5] overflow-hidden bg-surface-container-low transition-all duration-500 group-hover:scale-[0.98]">
          {img ? (
            <Image
              src={img}
              alt={`${auction.title} — past auction lot`}
              fill
              placeholder="blur"
              blurDataURL={TINY_IMAGE_BLUR}
              className="object-cover transition-transform duration-700 group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-on-surface-variant">
              No image
            </div>
          )}
        </div>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <span className="block font-label text-[0.625rem] uppercase tracking-[0.2em] text-on-surface-variant">
              Lot No. {lotNo(auction.id)} · {closingCaption(auction.endTime)}
            </span>
            <h3 className="font-headline text-2xl tracking-tight text-on-surface transition-colors group-hover:text-primary">
              {auction.title}
            </h3>
            <p className="text-sm font-light text-on-surface-variant">{sellerName}</p>
          </div>
          <div className="text-right">
            <span className="mb-1 block font-label text-[0.625rem] uppercase tracking-[0.2em] text-on-surface-variant">
              Hammer price
            </span>
            <span className="font-headline text-xl text-on-surface">
              {formatMoney(auction.currentPrice)}
            </span>
          </div>
        </div>
      </Link>
    </div>
  );
}
