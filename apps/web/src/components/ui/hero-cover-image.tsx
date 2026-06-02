"use client";

import { useAdaptiveMediaImageProps } from "@/components/ui/adaptive-media-frame";
import { HERO_COVER_DEFAULTS } from "@/lib/media/hero-cover-defaults";
import { type HeroCoverSources, heroCoverObjectPosition } from "@/lib/media/hero-cover-sources";
import { cn } from "@auction/ui";

type HeroCoverImageProps = {
  cover: HeroCoverSources;
  alt: string;
  className?: string;
  imgClassName?: string;
  priority?: boolean;
  sizes?: string;
};

/** Responsive hero cover — native img for overlay tone sampling; optional mobile art direction. */
export function HeroCoverImage({
  cover,
  alt,
  className,
  imgClassName,
  priority = false,
  sizes = HERO_COVER_DEFAULTS.sizes,
}: HeroCoverImageProps) {
  const { imgRef, onImageLoad } = useAdaptiveMediaImageProps();
  const { desktopUrl, mobileUrl, desktopWideUrl } = cover;

  if (!desktopUrl) {
    return null;
  }

  const positions = heroCoverObjectPosition(cover);
  const usePositionOverride = Boolean(cover.objectPosition);

  return (
    <picture className={cn("block h-full w-full", className)}>
      {desktopWideUrl ? (
        <source media={HERO_COVER_DEFAULTS.pictureDesktopWideMedia} srcSet={desktopWideUrl} />
      ) : null}
      {mobileUrl ? (
        <source media={HERO_COVER_DEFAULTS.pictureMobileMedia} srcSet={mobileUrl} />
      ) : null}
      <img
        ref={imgRef}
        src={desktopUrl}
        alt={alt}
        sizes={sizes}
        width={2560}
        height={900}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
        crossOrigin="anonymous"
        onLoad={onImageLoad}
        style={usePositionOverride ? { objectPosition: positions.mobile } : undefined}
        className={cn(
          "h-full w-full object-cover",
          !usePositionOverride && "object-[center_35%] md:object-center",
          imgClassName,
        )}
      />
    </picture>
  );
}
