import { LotStatusBadge, LotStatusTimer } from "@/components/marketing/lot-status-badge";
import { MediaImage } from "@/components/ui/media-image";
import Link from "next/link";
import type { ReactNode } from "react";
import type { SaleLotCardVM } from "./view-models";

type Props = {
  lot: SaleLotCardVM;
  /** Watchlist heart or similar — rendered top-right on the image, outside the artwork link. */
  cornerAction?: ReactNode;
  /** OCP: callers slot in Bid / Watch / Results actions without modifying the card.
   * Pass `null` to render the card without actions (e.g. ended sales).
   */
  actions?: ReactNode;
  /** Image sizes hint — defaults to 4-col grid; override for different grids. */
  sizes?: string;
  /** Visual emphasis hint for the price block. Defaults preserve the historical
   * rendering (estimate calm, current-bid bold) so callers that don't pass a
   * variant render unchanged.
   */
  priceEmphasis?: "estimate" | "currentBid" | "both";
  /** `row` = compact horizontal strip for catalogue list view. */
  layout?: "tile" | "row";
};

const DEFAULT_SIZES = "(max-width: 768px) 50vw, (max-width: 1024px) 50vw, 25vw";
const ROW_IMAGE_SIZES = "96px";

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

/** Figma saleroom lot tile — no Card chrome; fixed aspect image block with a live
 * countdown pill (live / opens-in / closed) overlaid on the artwork.
 */
export function SaleroomLotCard({
  lot,
  cornerAction,
  actions,
  sizes = DEFAULT_SIZES,
  priceEmphasis,
  layout = "tile",
}: Props) {
  const emphasis = priceEmphasis ?? (lot.isLive ? "currentBid" : "estimate");
  const estimateStrong = emphasis === "estimate" || emphasis === "both";
  const currentStrong = emphasis === "currentBid" || emphasis === "both";
  const isRow = layout === "row";

  if (isRow) {
    return (
      <article className="group flex w-full min-w-0 flex-row gap-4 py-4">
        <div className="relative size-24 shrink-0">
          <Link
            href={lot.href}
            className="relative block size-full overflow-hidden rounded-md bg-surface-container-high focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary dark:bg-surface-container-high"
            aria-label={`${lot.lotLabel ? `${lot.lotLabel}: ` : ""}${lot.title}`}
          >
            <MediaImage
              src={lot.imageUrl}
              alt={lot.imageAlt}
              label="Lot artwork"
              sizes={ROW_IMAGE_SIZES}
              className="size-full"
              imgClassName="size-full object-cover transition-transform duration-700 ease-out motion-safe:group-hover:scale-[1.03] motion-reduce:group-hover:scale-100"
            />
          </Link>
          {cornerAction ? (
            <div className="pointer-events-auto absolute right-1 top-1 z-10">{cornerAction}</div>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {lot.lotLabel ? (
              <p className="text-xs font-bold uppercase leading-4 text-lot-orange">
                {lot.lotLabel}
              </p>
            ) : null}
            <LotStatusBadge
              status={lot.status}
              startTime={lot.startTime}
              endTime={lot.endTime}
              closingShort={lot.closingShort}
            />
          </div>
          <div>
            <Link
              href={lot.href}
              className="line-clamp-2 block text-base font-semibold leading-snug text-brand-900 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary dark:text-on-surface"
            >
              {lot.title}
            </Link>
            {lot.artistOrMedium ? (
              <p className="line-clamp-1 mt-0.5 text-xs font-light leading-4 text-brand-500 dark:text-on-surface-variant">
                {lot.artistOrMedium}
              </p>
            ) : null}
          </div>

          <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 text-xs text-brand-400 dark:text-on-surface-variant">
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

          {actions ? <div className="mt-1 w-full min-w-0">{actions}</div> : null}
        </div>
      </article>
    );
  }

  return (
    <article className="group flex h-full w-full min-w-0 flex-col gap-4 motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-out motion-safe:hover:-translate-y-0.5">
      <div className="relative w-full">
        <Link
          href={lot.href}
          className="relative block aspect-[320/340] w-full min-h-0 overflow-hidden bg-surface-container-high focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary dark:bg-surface-container-high"
          aria-label={`${lot.lotLabel ? `${lot.lotLabel}: ` : ""}${lot.title}`}
        >
          <MediaImage
            src={lot.imageUrl}
            alt={lot.imageAlt}
            label="Lot artwork"
            sizes={sizes}
            imgClassName="transition-transform duration-700 ease-out motion-safe:group-hover:scale-[1.03] motion-reduce:group-hover:scale-100"
          />
          <LotStatusTimer status={lot.status} startTime={lot.startTime} endTime={lot.endTime} />
        </Link>
        {cornerAction ? (
          <div className="pointer-events-auto absolute right-3 top-3 z-10">{cornerAction}</div>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        {lot.lotLabel ? (
          <p className="text-sm font-bold uppercase leading-4 text-lot-orange">{lot.lotLabel}</p>
        ) : null}
        <div>
          <Link
            href={lot.href}
            className="line-clamp-2 block text-sm font-semibold leading-snug text-brand-900 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary md:text-lg md:leading-6 dark:text-on-surface"
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

      {actions ? (
        <div className="mt-auto flex w-full min-w-0 flex-col gap-2 text-xs sm:flex-row sm:text-sm">
          {actions}
        </div>
      ) : null}
    </article>
  );
}
