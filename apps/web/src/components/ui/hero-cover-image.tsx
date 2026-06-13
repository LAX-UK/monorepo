"use client";

import { useAdaptiveMediaImageProps } from "@/components/ui/adaptive-media-frame";
import { HERO_COVER_DEFAULTS } from "@/lib/media/hero-cover-defaults";
import { type HeroCoverSources, heroCoverObjectPosition } from "@/lib/media/hero-cover-sources";
import { cn } from "@auction/ui";
import { getImageProps } from "next/image";
import { useCallback, useMemo, useState } from "react";

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

const HERO_WIDTH = 2560;
const HERO_HEIGHT = 900;

function optimizedHeroSrc(src: string, alt: string, sizes: string, priority: boolean) {
  const { props } = getImageProps({
    src,
    alt,
    width: HERO_WIDTH,
    height: HERO_HEIGHT,
    sizes,
    priority,
  });
  return { src: props.src, srcSet: props.srcSet };
}

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

  const desktopOptimized = useMemo(
    () => (desktopUrl ? optimizedHeroSrc(desktopUrl, alt, sizes, priority) : null),
    [desktopUrl, alt, sizes, priority],
  );
  const mobileOptimized = useMemo(
    () => (mobileUrl ? optimizedHeroSrc(mobileUrl, alt, sizes, priority) : null),
    [mobileUrl, alt, sizes, priority],
  );
  const desktopWideOptimized = useMemo(
    () => (desktopWideUrl ? optimizedHeroSrc(desktopWideUrl, alt, sizes, priority) : null),
    [desktopWideUrl, alt, sizes, priority],
  );

  if (!desktopUrl || !desktopOptimized) {
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
        {desktopWideOptimized ? (
          <source
            media={HERO_COVER_DEFAULTS.pictureDesktopWideMedia}
            srcSet={desktopWideOptimized.srcSet}
          />
        ) : null}
        {mobileOptimized ? (
          <source media={HERO_COVER_DEFAULTS.pictureMobileMedia} srcSet={mobileOptimized.srcSet} />
        ) : null}
        <img
          ref={assignImgRef}
          src={desktopOptimized.src}
          srcSet={desktopOptimized.srcSet}
          alt={alt}
          sizes={sizes}
          width={HERO_WIDTH}
          height={HERO_HEIGHT}
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
