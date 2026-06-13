"use client";

import { MediaPlaceholder, type MediaPlaceholderProps } from "@/components/ui/media-placeholder";
import { resolveMediaSrc } from "@/lib/media/resolve-media-src";
import { cn } from "@auction/ui";
import Image from "next/image";
import { type Ref, useEffect, useState } from "react";

type MediaImageProps = {
  src: string | null | undefined;
  alt: string;
  label?: string | undefined;
  tone?: MediaPlaceholderProps["tone"] | undefined;
  aspect?: MediaPlaceholderProps["aspect"] | undefined;
  shape?: MediaPlaceholderProps["shape"] | undefined;
  sizes?: string | undefined;
  className?: string | undefined;
  imgClassName?: string | undefined;
  priority?: boolean | undefined;
  onClick?: (() => void) | undefined;
  placeholderClassName?: string | undefined;
  /** Ref to the underlying rendered `<img>` (for overlay tone sampling). */
  imgRef?: Ref<HTMLImageElement>;
  /** Fired after internal loaded state transitions. */
  onImageLoad?: (() => void) | undefined;
  /** Set for canvas sampling only; omit for prod image loading (default). */
  crossOrigin?: "anonymous";
  /** Server-generated LQIP from `media_asset` when available. */
  blurDataURL?: string | undefined;
  width?: number | undefined;
  height?: number | undefined;
};

export function MediaImage({
  src,
  alt,
  label,
  tone = "auto",
  aspect,
  shape = "rect",
  sizes,
  className,
  imgClassName,
  priority = false,
  onClick,
  placeholderClassName,
  imgRef,
  onImageLoad,
  crossOrigin,
  blurDataURL,
  width,
  height,
}: MediaImageProps) {
  const normalizedSrc = resolveMediaSrc(src);
  const [status, setStatus] = useState<"loading" | "loaded" | "error">(
    normalizedSrc ? "loading" : "error",
  );
  // Skip LQIP on priority (LCP) images — shimmer is enough; blur adds decode cost.
  const useBlurPlaceholder = Boolean(blurDataURL) && !priority;
  const intrinsicAspect =
    aspect ??
    (width != null && height != null && width > 0 && height > 0
      ? ([width, height] as const)
      : undefined);
  const hasAspect = intrinsicAspect != null;

  useEffect(() => {
    setStatus(normalizedSrc ? "loading" : "error");
  }, [normalizedSrc]);

  const showPlaceholder = !normalizedSrc || (status !== "loaded" && !useBlurPlaceholder);
  const isCircle = shape === "circle";

  return (
    <div
      className={cn(
        "relative overflow-hidden",
        hasAspect ? "w-full" : "h-full w-full",
        isCircle && "rounded-full",
        className,
      )}
      style={
        hasAspect ? { aspectRatio: `${intrinsicAspect[0]} / ${intrinsicAspect[1]}` } : undefined
      }
    >
      {showPlaceholder ? (
        <MediaPlaceholder
          tone={tone}
          shape={shape}
          loading={Boolean(normalizedSrc && status === "loading")}
          {...(label !== undefined ? { label } : {})}
          {...(placeholderClassName !== undefined ? { className: placeholderClassName } : {})}
        />
      ) : null}
      {normalizedSrc && status !== "error" ? (
        <Image
          ref={imgRef}
          src={normalizedSrc}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          {...(useBlurPlaceholder && blurDataURL
            ? { placeholder: "blur" as const, blurDataURL }
            : {})}
          {...(crossOrigin ? { crossOrigin } : {})}
          onLoad={() => {
            setStatus("loaded");
            onImageLoad?.();
          }}
          onError={() => setStatus("error")}
          onClick={onClick}
          className={cn(
            "object-cover",
            !useBlurPlaceholder &&
              "opacity-0 transition-opacity duration-300 motion-reduce:transition-none",
            !useBlurPlaceholder && status === "loaded" && "opacity-100",
            onClick && "cursor-pointer",
            imgClassName,
          )}
        />
      ) : null}
    </div>
  );
}

export type { MediaImageProps };
