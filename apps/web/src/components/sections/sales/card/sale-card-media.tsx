"use client";

import { SaleStatusBadge } from "@/components/marketing/sale-status-badge";
import type { SaleCardMediaProps } from "@/components/sections/sales/card/types";
import { AdaptiveFrameImage } from "@/components/ui/adaptive-frame-image";
import { AdaptiveMediaFrame } from "@/components/ui/adaptive-media-frame";
import { MediaImage } from "@/components/ui/media-image";
import { LOT_CARD_TIMER_SLOTS } from "@/lib/media/overlay-slot-presets";
import { cn } from "@auction/ui";
import Link from "next/link";

const DEFAULT_SIZES = "(max-width: 1024px) 100vw, 420px";

const SALE_MEDIA_SLOTS = [...LOT_CARD_TIMER_SLOTS.filter((slot) => slot.name !== "topLeft")];

const ROOT_SHELL = "group/image relative overflow-hidden bg-surface-container";

function layoutClass(layout: SaleCardMediaProps["layout"]) {
  return layout === "featured"
    ? "aspect-[16/10] w-full lg:aspect-[16/9]"
    : "aspect-[16/10] w-full shrink-0 md:aspect-auto md:h-[180px] md:w-[36%] md:max-w-[300px] lg:h-[220px] lg:w-[38%] lg:max-w-[340px]";
}

function MediaImageBlock({
  coverImageUrl,
  coverImageAlt,
  sizes,
  adaptive,
}: {
  coverImageUrl: string | null | undefined;
  coverImageAlt: string;
  sizes: string;
  adaptive: boolean;
}) {
  const imgClassName = cn(
    "size-full object-cover transition-transform duration-700 ease-out",
    "motion-safe:group-hover/image:scale-[1.03] motion-reduce:group-hover/image:scale-100",
  );

  if (adaptive) {
    return (
      <AdaptiveFrameImage
        src={coverImageUrl}
        alt={coverImageAlt}
        objectFit="cover"
        label="Auction cover"
        className="absolute inset-0 size-full"
        sizes={sizes}
        imgClassName={imgClassName}
      />
    );
  }

  return (
    <MediaImage
      src={coverImageUrl}
      alt={coverImageAlt}
      label="Auction cover"
      className="absolute inset-0 size-full"
      imgClassName={imgClassName}
      sizes={sizes}
    />
  );
}

function MediaShell({
  href,
  coverImageUrl,
  coverImageAlt,
  countdownEndIso,
  isLive,
  sizes,
  className,
  linkMode,
  imageRoundedClassName,
  scrimClassName,
  layout,
  adaptive,
}: SaleCardMediaProps & { adaptive: boolean }) {
  const shellClass = cn(ROOT_SHELL, layoutClass(layout), imageRoundedClassName, className);

  const imageBlock = (
    <>
      <MediaImageBlock
        coverImageUrl={coverImageUrl}
        coverImageAlt={coverImageAlt}
        sizes={sizes ?? DEFAULT_SIZES}
        adaptive={adaptive}
      />
      {scrimClassName ? (
        <div className={cn("pointer-events-none absolute inset-0", scrimClassName)} aria-hidden />
      ) : null}
      {isLive && countdownEndIso ? <SaleStatusBadge countdownEndIso={countdownEndIso} /> : null}
    </>
  );

  const inner =
    linkMode === "area" ? (
      <Link
        href={href}
        className="absolute inset-0 block"
        aria-label={`View images for ${coverImageAlt}`}
      >
        {imageBlock}
      </Link>
    ) : (
      <div className="absolute inset-0">{imageBlock}</div>
    );

  if (adaptive) {
    return (
      <AdaptiveMediaFrame
        src={coverImageUrl}
        objectFit="cover"
        slots={SALE_MEDIA_SLOTS}
        containerRefOnRoot
        className={shellClass}
      >
        {inner}
      </AdaptiveMediaFrame>
    );
  }

  return <div className={shellClass}>{inner}</div>;
}

export function SaleCardMedia({
  linkMode = "area",
  imageRoundedClassName = "rounded-md",
  scrimClassName = "bg-black/10",
  layout = "calendarRow",
  ...rest
}: SaleCardMediaProps) {
  const useAdaptiveOverlay = Boolean(rest.coverImageUrl);

  return (
    <MediaShell
      {...rest}
      linkMode={linkMode}
      imageRoundedClassName={imageRoundedClassName}
      scrimClassName={scrimClassName}
      layout={layout}
      adaptive={useAdaptiveOverlay}
    />
  );
}
