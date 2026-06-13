"use client";

import type { AdaptiveMediaConfig } from "@/components/marketing/adaptive-media-config";
import { LotViewTransitionLink } from "@/components/marketing/lot-view-transition-link";
import { AdaptiveFrameImage } from "@/components/ui/adaptive-frame-image";
import {
  AdaptiveMediaFrame,
  AdaptiveMediaFrameContainer,
} from "@/components/ui/adaptive-media-frame";
import { MediaImage } from "@/components/ui/media-image";
import { LOT_TRANSITION_IMAGE_ATTR, LOT_TRANSITION_ROOT_ATTR } from "@/lib/view-transitions";
import { cn } from "@auction/ui";
import { Fragment, type ReactNode } from "react";

export type MarketingLotTileProps = {
  lotId: string;
  href: string;
  linkAriaLabel: string;
  imageUrl: string | null;
  imageAlt: string;
  sizes: string;
  adaptiveMedia?: AdaptiveMediaConfig;
  cornerAction?: ReactNode;
  topOverlay?: ReactNode;
  belowImage: ReactNode;
  articleClassName?: string;
};

/** Shared 340px marketing hero shell for home lot tiles (Editor's Picks + Urgency). Presentational — wrap in `MarketingCardReveal` at the grid. */
export function MarketingLotTile({
  lotId,
  href,
  linkAriaLabel,
  imageUrl,
  imageAlt,
  sizes,
  adaptiveMedia,
  cornerAction,
  topOverlay,
  belowImage,
  articleClassName,
}: MarketingLotTileProps) {
  const imageNode = adaptiveMedia ? (
    <AdaptiveFrameImage
      src={adaptiveMedia.src}
      alt={adaptiveMedia.alt}
      objectFit={adaptiveMedia.objectFit}
      {...(adaptiveMedia.sizes ? { sizes: adaptiveMedia.sizes } : { sizes })}
      {...(adaptiveMedia.label ? { label: adaptiveMedia.label } : { label: "Lot artwork" })}
      className="h-full w-full"
      imgClassName="h-full w-full transition-transform duration-700 ease-out motion-safe:group-hover:scale-105 motion-reduce:group-hover:scale-100"
    />
  ) : (
    <MediaImage
      src={imageUrl}
      alt={imageAlt}
      label="Lot artwork"
      imgClassName="h-full w-full object-cover transition-transform duration-700 ease-out motion-safe:group-hover:scale-105 motion-reduce:group-hover:scale-100"
      sizes={sizes}
    />
  );

  const tile = (
    <article
      className={cn("flex min-w-0 w-full flex-col gap-4", articleClassName)}
      {...{ [LOT_TRANSITION_ROOT_ATTR]: lotId }}
    >
      <AdaptiveMediaFrameContainer
        {...{ [LOT_TRANSITION_IMAGE_ATTR]: true }}
        className="group relative flex h-[340px] w-full flex-col overflow-hidden bg-page-bg"
      >
        <LotViewTransitionLink
          key={`${lotId}-link`}
          lotId={lotId}
          href={href}
          className="absolute inset-0 z-0 overflow-hidden outline-offset-4 focus-visible:z-[5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          aria-label={linkAriaLabel}
        >
          {imageNode}
        </LotViewTransitionLink>
        {topOverlay ? <Fragment key={`${lotId}-top-overlay`}>{topOverlay}</Fragment> : null}
        {cornerAction ? <Fragment key={`${lotId}-corner-action`}>{cornerAction}</Fragment> : null}
      </AdaptiveMediaFrameContainer>
      <Fragment key={`${lotId}-below-image`}>{belowImage}</Fragment>
    </article>
  );

  if (!adaptiveMedia || adaptiveMedia.slots.length === 0) return tile;

  return (
    <AdaptiveMediaFrame
      src={adaptiveMedia.src}
      objectFit={adaptiveMedia.objectFit}
      slots={adaptiveMedia.slots}
    >
      {tile}
    </AdaptiveMediaFrame>
  );
}
