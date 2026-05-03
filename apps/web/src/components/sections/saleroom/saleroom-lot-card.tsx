import { LotCardTimer } from "@/components/lot-timer";
import { ImagePlaceholder } from "@/components/ui/image-placeholder";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import type { SaleLotCardVM } from "./view-models";

type Props = {
  lot: SaleLotCardVM;
  /**
   * OCP: callers slot in Bid / Watch / Results actions without modifying the card.
   * Pass `null` to render the card without actions (e.g. ended sales).
   */
  actions?: ReactNode;
  /** Image sizes hint — defaults to 4-col grid; override for different grids. */
  sizes?: string;
  /**
   * Visual emphasis hint for the price block. Defaults preserve the historical
   * rendering (estimate calm, current-bid bold) so callers that don't pass a
   * variant render unchanged.
   */
  priceEmphasis?: "estimate" | "currentBid" | "both";
};

const DEFAULT_SIZES = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw";

function MetaStack({
  label,
  value,
  strongValue,
}: { label: string; value: string; strongValue?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-xs leading-4 text-brand-400 dark:text-on-surface-variant">{label}</span>
      <span
        className={`text-sm leading-6 text-brand-400 dark:text-on-surface-variant ${strongValue ? "font-semibold text-brand-900 dark:text-on-surface" : "font-medium"}`}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * Figma saleroom lot tile — no Card chrome; fixed aspect image block with a live
 * countdown pill (live / opens-in / closed) overlaid on the artwork.
 */
export function SaleroomLotCard({ lot, actions, sizes = DEFAULT_SIZES, priceEmphasis }: Props) {
  const emphasis = priceEmphasis ?? (lot.isLive ? "currentBid" : "estimate");
  const estimateStrong = emphasis === "estimate" || emphasis === "both";
  const currentStrong = emphasis === "currentBid" || emphasis === "both";
  return (
    <article className="group flex h-full w-full min-w-0 flex-col gap-4">
      <Link
        href={lot.href}
        className="relative block aspect-[320/340] w-full min-h-0 overflow-hidden bg-surface-container-high focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary dark:bg-surface-container-high"
        aria-label={`${lot.lotLabel ? `${lot.lotLabel}: ` : ""}${lot.title}`}
      >
        {lot.imageUrl ? (
          <Image
            src={lot.imageUrl}
            alt={lot.imageAlt}
            fill
            sizes={sizes}
            className="object-cover transition-transform duration-700 ease-out motion-safe:group-hover:scale-105 motion-reduce:group-hover:scale-100"
          />
        ) : (
          <ImagePlaceholder label="Lot artwork" />
        )}
        <LotCardTimer status={lot.status} startTime={lot.startTime} endTime={lot.endTime} />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        {lot.lotLabel ? (
          <p className="text-sm font-bold uppercase leading-4 text-lot-orange">{lot.lotLabel}</p>
        ) : null}
        <div>
          <Link
            href={lot.href}
            className="line-clamp-2 block text-lg font-semibold leading-6 text-brand-900 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary dark:text-on-surface"
          >
            {lot.title}
          </Link>
          {lot.artistOrMedium ? (
            <p className="line-clamp-1 mt-1 text-sm font-light leading-4 text-brand-500 dark:text-on-surface-variant">
              {lot.artistOrMedium}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 text-xs text-brand-400 dark:text-on-surface-variant">
          <MetaStack
            label="Estimate"
            value={lot.estimateValue ?? "—"}
            strongValue={estimateStrong}
          />
          <MetaStack
            label={
              lot.bidsCountLabel
                ? `${lot.currentBidLabel} · ${lot.bidsCountLabel}`
                : lot.currentBidLabel
            }
            value={lot.currentBidValue}
            strongValue={currentStrong}
          />
        </div>
      </div>

      {actions ? <div className="mt-auto w-full min-w-0">{actions}</div> : null}
    </article>
  );
}
