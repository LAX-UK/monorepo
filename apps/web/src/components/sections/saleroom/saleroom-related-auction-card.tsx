import { TINY_IMAGE_BLUR } from "@/lib/image-blur";
import { Calendar, ImageIcon, Package } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { RelatedSaleVM } from "./view-models";

type Props = {
  sale: RelatedSaleVM;
};

/**
 * Horizontal card for related auctions (image left, meta right) — matches Figma.
 */
export function SaleroomRelatedAuctionCard({ sale }: Props) {
  return (
    <Link
      href={sale.href}
      className="group grid grid-cols-[120px_1fr] gap-4 rounded-lg bg-surface-container-low/50 p-4 ring-1 ring-outline-variant/20 transition-all hover:ring-outline-variant/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:grid-cols-[160px_1fr]"
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded bg-surface-container-high">
        {sale.imageUrl ? (
          <Image
            src={sale.imageUrl}
            alt={sale.title}
            fill
            sizes="(max-width: 640px) 30vw, 160px"
            placeholder="blur"
            blurDataURL={TINY_IMAGE_BLUR}
            className="object-cover transition-transform duration-500 motion-safe:group-hover:scale-105"
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center text-xs text-on-surface-variant"
            aria-hidden
          >
            <ImageIcon className="size-6" aria-hidden />
          </div>
        )}
      </div>
      <div className="flex flex-col justify-between gap-2 py-1">
        <div>
          <p className="font-label text-[0.6rem] uppercase tracking-widest text-primary">
            {sale.kindLabel}
          </p>
          <h3 className="mt-1 line-clamp-2 font-headline text-base text-on-surface group-hover:text-primary">
            {sale.title}
          </h3>
        </div>
        <dl className="flex flex-wrap items-center gap-x-4 gap-y-1 font-label text-[0.65rem] uppercase tracking-widest text-on-surface-variant">
          <div className="flex items-center gap-1">
            <Calendar className="text-xs" aria-hidden />
            <dt className="sr-only">Dates</dt>
            <dd>{sale.dateLabel}</dd>
          </div>
          <div className="flex items-center gap-1">
            <Package className="text-xs" aria-hidden />
            <dt className="sr-only">Items</dt>
            <dd>{sale.itemsLabel}</dd>
          </div>
        </dl>
      </div>
    </Link>
  );
}
