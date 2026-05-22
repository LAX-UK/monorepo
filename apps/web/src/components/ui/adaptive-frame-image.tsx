"use client";

import { useAdaptiveMediaImageProps } from "@/components/ui/adaptive-media-frame";
import { MediaImage } from "@/components/ui/media-image";
import type { ObjectFitMode } from "@/lib/media/overlay-tone-types";
import { cn } from "@auction/ui";

type Props = {
  src: string | null | undefined;
  alt: string;
  objectFit: ObjectFitMode;
  sizes?: string;
  label?: string;
  className?: string;
  imgClassName?: string;
  priority?: boolean;
};

/** MediaImage wired to the nearest AdaptiveMediaFrame sampling refs. */
export function AdaptiveFrameImage({
  src,
  alt,
  objectFit,
  sizes,
  label = "Artwork",
  className,
  imgClassName,
  priority = false,
}: Props) {
  const { imgRef, onImageLoad } = useAdaptiveMediaImageProps();

  return (
    <MediaImage
      src={src}
      alt={alt}
      label={label}
      sizes={sizes}
      className={className}
      imgRef={imgRef}
      onImageLoad={onImageLoad}
      priority={priority}
      crossOrigin="anonymous"
      imgClassName={cn(objectFit === "contain" ? "object-contain" : "object-cover", imgClassName)}
    />
  );
}
