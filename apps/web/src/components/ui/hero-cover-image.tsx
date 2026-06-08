"use client";

import { useAdaptiveMediaImageProps } from "@/components/ui/adaptive-media-frame";
import { HERO_COVER_DEFAULTS } from "@/lib/media/hero-cover-defaults";
import { type HeroCoverSources, heroCoverObjectPosition } from "@/lib/media/hero-cover-sources";
import { cn } from "@auction/ui";
import { useCallback, useState } from "react";

type HeroCoverImageProps = {
  cover: HeroCoverSources;
  alt: string;
  className?: string;
  imgClassName?: string;
  priority?: boolean;
  sizes?: string;
  /** Fade in after decode. Skipped when `priority` is true (LCP guard). Defaults to true. */
  fadeInOnLoad?: boolean;
  /** Show shimmer placeholder while loading. Defaults to true. */
  showPlaceholder?: boolean;
};

/** Responsive hero cover — native img for overlay tone sampling; optional mobile art direction. */
export function HeroCoverImage({
  cover,
  alt,
  className,
  imgClassName,
  priority = false,
  sizes = HERO_COVER_DEFAULTS.sizes,
  fadeInOnLoad = true,
  showPlaceholder = true,
}: HeroCoverImageProps) {
  const { imgRef, onImageLoad } = useAdaptiveMediaImageProps();
  const { desktopUrl, mobileUrl, desktopWideUrl } = cover;
  const [loaded, setLoaded] = useState(false);

  const markLoaded = useCallback(() => {
    setLoaded(true);
    onImageLoad();
  }, [onImageLoad]);

  const assignImgRef = useCallback(
    (node: HTMLImageElement | null) => {
      imgRef.current = node;
      if (node?.complete && node.naturalWidth > 0) {
        markLoaded();
      }
    },
    [imgRef, markLoaded],
  );

  if (!desktopUrl) {
    return null;
  }

  const positions = heroCoverObjectPosition(cover);
  const usePositionOverride = Boolean(cover.objectPosition);
  const shouldFadeIn = fadeInOnLoad && !priority;
  const showLoadingPlaceholder = showPlaceholder && !loaded;

  return (
    <div className={cn("relative h-full w-full", className)}>
      {showLoadingPlaceholder ? (
        <div aria-hidden className="absolute inset-0 bg-surface-container-high shimmer-sweep" />
      ) : null}
      <picture className="block h-full w-full">
        {desktopWideUrl ? (
          <source media={HERO_COVER_DEFAULTS.pictureDesktopWideMedia} srcSet={desktopWideUrl} />
        ) : null}
        {mobileUrl ? (
          <source media={HERO_COVER_DEFAULTS.pictureMobileMedia} srcSet={mobileUrl} />
        ) : null}
        <img
          ref={assignImgRef}
          src={desktopUrl}
          alt={alt}
          sizes={sizes}
          width={2560}
          height={900}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          decoding="async"
          crossOrigin="anonymous"
          onLoad={markLoaded}
          style={usePositionOverride ? { objectPosition: positions.mobile } : undefined}
          className={cn(
            "h-full w-full object-cover",
            !usePositionOverride && "object-[center_35%] md:object-center",
            shouldFadeIn &&
              "opacity-0 transition-opacity duration-300 motion-reduce:transition-none",
            shouldFadeIn && loaded && "opacity-100",
            imgClassName,
          )}
        />
      </picture>
    </div>
  );
}
