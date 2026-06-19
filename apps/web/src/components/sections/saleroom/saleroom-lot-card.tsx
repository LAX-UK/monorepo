"use client";

import { LotLifecycleStatusBadge } from "@/components/marketing/lot-lifecycle-status-badge";
import { LotStatusBadge, LotStatusTimer } from "@/components/marketing/lot-status-badge";
import { AdaptiveFrameImage } from "@/components/ui/adaptive-frame-image";
import {
  AdaptiveMediaFrame,
  AdaptiveMediaFrameContainer,
} from "@/components/ui/adaptive-media-frame";
import { saleroomOnBlockBadge } from "@/lib/lot/lot-lifecycle";
import { LOT_CARD_GRID_SLOTS, LOT_CARD_TIMER_SLOTS } from "@/lib/media/overlay-slot-presets";
import { lotStatusBadgeProps } from "@/lib/presenters/lot-status-badge-props";
import { cn } from "@auction/ui";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import type { SaleLotCardVM } from "./view-models";

type Props = {
  lot: SaleLotCardVM;
  /** Grid/tile image overlays (watchlist + quick-look). */
  cornerAction?: ReactNode;
  /** List row actions beside title (inline heart + quick-look). */
  listActions?: ReactNode;
  actions?: ReactNode;
  sizes?: string;
  priceEmphasis?: "estimate" | "currentBid" | "both";
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

export function SaleroomLotCard({
  lot,
  cornerAction,
  listActions,
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
    const rowImage = (
      <article className="group flex w-full min-w-0 flex-row gap-4 py-4">
        <div className="relative size-24 shrink-0">
          <Link
            href={lot.href}
            prefetch={false}
            className="relative block size-full overflow-hidden rounded-md bg-surface-container-high focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring dark:bg-surface-container-high"
            aria-label={`${lot.lotLabel ? `${lot.lotLabel}: ` : ""}${lot.title}`}
          >
            <AdaptiveMediaFrameContainer className="absolute inset-0">
              <AdaptiveFrameImage
                src={lot.imageUrl}
                alt={lot.imageAlt}
                objectFit="cover"
                sizes={ROW_IMAGE_SIZES}
                className="size-full"
                imgClassName="size-full object-cover transition-transform duration-700 ease-out motion-safe:group-hover:scale-[1.02] motion-reduce:group-hover:scale-100"
              />
            </AdaptiveMediaFrameContainer>
          </Link>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {lot.lotLabel ? (
              <p className="text-xs font-bold uppercase leading-4 text-lot-orange">
                {lot.lotLabel}
              </p>
            ) : null}
            {lot.isOnBlock ? <LotLifecycleStatusBadge badge={saleroomOnBlockBadge()} /> : null}
            <LotStatusBadge {...lotStatusBadgeProps(lot)} />
          </div>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <Link
                href={lot.href}
                prefetch={false}
                className="line-clamp-2 block text-base font-semibold leading-snug text-brand-900 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring dark:text-on-surface"
              >
                {lot.title}
              </Link>
              {lot.artistOrMedium ? (
                <p className="line-clamp-1 mt-0.5 text-xs font-light leading-4 text-brand-500 dark:text-on-surface-variant">
                  {lot.artistOrMedium}
                </p>
              ) : null}
            </div>
            {listActions ? (
              <div className="pointer-events-auto relative z-[2] shrink-0">{listActions}</div>
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

    if (!lot.imageUrl) return rowImage;

    return (
      <AdaptiveMediaFrame src={lot.imageUrl} objectFit="cover" slots={LOT_CARD_GRID_SLOTS}>
        {rowImage}
      </AdaptiveMediaFrame>
    );
  }

  const tile = (
    <article className="group flex h-full w-full min-w-0 flex-col gap-4 motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-out motion-safe:hover:-translate-y-0.5">
      <div className="relative w-full">
        <Link
          href={lot.href}
          className={cn(
            "relative block aspect-[4/5] w-full min-h-0 overflow-hidden rounded-lg bg-surface-container-high transition-shadow motion-safe:group-hover:ring-1 motion-safe:group-hover:ring-primary/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring dark:bg-surface-container-high",
            lot.isOnBlock && "ring-2 ring-error/40",
          )}
          aria-label={`${lot.lotLabel ? `${lot.lotLabel}: ` : ""}${lot.title}`}
        >
          <AdaptiveMediaFrameContainer className="absolute inset-0">
            <AdaptiveFrameImage
              src={lot.imageUrl}
              alt={lot.imageAlt}
              objectFit="cover"
              sizes={sizes}
              imgClassName="transition-transform duration-700 ease-out motion-safe:group-hover:scale-[1.02] motion-reduce:group-hover:scale-100"
            />
          </AdaptiveMediaFrameContainer>
          <LotStatusTimer
            overlay
            status={lot.status}
            startTime={lot.startTime}
            endTime={lot.endTime}
          />
        </Link>
        {cornerAction ? <Fragment key={`${lot.id}-corner-action`}>{cornerAction}</Fragment> : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <p
          className={cn(
            "min-h-5 text-sm font-bold uppercase leading-4 text-lot-orange",
            !lot.lotLabel && "invisible",
          )}
        >
          {lot.lotLabel ?? "Lot"}
        </p>
        {lot.isOnBlock ? (
          <LotLifecycleStatusBadge badge={saleroomOnBlockBadge()} className="self-start" />
        ) : null}
        <div>
          <Link
            href={lot.href}
            className="line-clamp-2 block min-h-12 text-sm font-semibold leading-snug text-brand-900 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:text-lg md:leading-6 dark:text-on-surface"
          >
            {lot.title}
          </Link>
          <p className="line-clamp-1 mt-1 min-h-4 text-sm font-light leading-4 text-brand-500 dark:text-on-surface-variant">
            {lot.artistOrMedium ?? "\u00a0"}
          </p>
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

        {actions ? <div className="mt-auto w-full min-w-0">{actions}</div> : null}
      </div>
    </article>
  );

  return (
    <AdaptiveMediaFrame
      src={lot.imageUrl}
      objectFit="cover"
      slots={LOT_CARD_TIMER_SLOTS}
      className="flex h-full min-w-0 flex-col"
    >
      {tile}
    </AdaptiveMediaFrame>
  );
}
