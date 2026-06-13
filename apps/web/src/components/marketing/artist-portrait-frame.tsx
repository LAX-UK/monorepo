"use client";

import { AdaptiveFrameImage } from "@/components/ui/adaptive-frame-image";
import {
  AdaptiveMediaFrame,
  AdaptiveMediaFrameContainer,
} from "@/components/ui/adaptive-media-frame";
import { ARTIST_PORTRAIT_SLOTS } from "@/lib/media/overlay-slot-presets";
import { cn } from "@auction/ui";

type Props = {
  src: string | null | undefined;
  alt: string;
  label: string;
  sizes: string;
  imgClassName?: string;
};

/** Portrait media with adaptive overlay tone for on-image follow hearts. */
export function ArtistPortraitFrame({ src, alt, label, sizes, imgClassName }: Props) {
  return (
    <AdaptiveMediaFrame src={src} objectFit="cover" slots={ARTIST_PORTRAIT_SLOTS}>
      <AdaptiveMediaFrameContainer className="absolute inset-0">
        <AdaptiveFrameImage
          src={src}
          alt={alt}
          label={label}
          objectFit="cover"
          sizes={sizes}
          className="size-full"
          imgClassName={cn("size-full object-cover", imgClassName)}
        />
      </AdaptiveMediaFrameContainer>
    </AdaptiveMediaFrame>
  );
}
