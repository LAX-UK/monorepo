"use client";

import { AdaptiveFrameImage } from "@/components/ui/adaptive-frame-image";
import {
  AdaptiveMediaFrame,
  AdaptiveMediaFrameContainer,
} from "@/components/ui/adaptive-media-frame";
import { HERO_IMMERSIVE_SLOTS } from "@/lib/media/overlay-slot-presets";
import type { ReactNode } from "react";

type Props = {
  src: string | null | undefined;
  alt: string;
  sizes?: string;
  priority?: boolean;
  imgClassName?: string;
  backdropScrim?: ReactNode;
  children: ReactNode;
};

/** Full-bleed hero shell with image sampling + grouped copy block tone. */
export function HeroAdaptiveShell({
  src,
  alt,
  sizes = "100vw",
  priority = false,
  imgClassName,
  backdropScrim,
  children,
}: Props) {
  return (
    <AdaptiveMediaFrame src={src} objectFit="cover" slots={HERO_IMMERSIVE_SLOTS}>
      <AdaptiveMediaFrameContainer className="absolute inset-0 overflow-hidden">
        <AdaptiveFrameImage
          src={src}
          alt={alt}
          objectFit="cover"
          sizes={sizes}
          label="Hero artwork"
          className="h-full w-full"
          priority={priority}
          {...(imgClassName ? { imgClassName } : {})}
        />
        {backdropScrim}
      </AdaptiveMediaFrameContainer>
      <div data-overlay-content-block>{children}</div>
    </AdaptiveMediaFrame>
  );
}
