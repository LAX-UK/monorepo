"use client";

import { AdaptiveFrameImage } from "@/components/ui/adaptive-frame-image";
import {
  AdaptiveMediaFrame,
  AdaptiveMediaFrameContainer,
} from "@/components/ui/adaptive-media-frame";
import { HERO_IMMERSIVE_SLOTS } from "@/lib/media/overlay-slot-presets";
import { cn } from "@auction/ui";
import type { ReactNode } from "react";

type Props = {
  src: string | null | undefined;
  alt: string;
  sizes?: string;
  priority?: boolean;
  imgClassName?: string;
  backdropScrim?: ReactNode;
  /** Applied to the AdaptiveMediaFrame root. */
  className?: string;
  /** Applied to the sized inner shell that prevents absolute-child collapse. */
  shellClassName?: string;
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
  className,
  shellClassName,
  children,
}: Props) {
  return (
    <AdaptiveMediaFrame
      src={src}
      objectFit="cover"
      slots={HERO_IMMERSIVE_SLOTS}
      {...(className ? { className } : {})}
    >
      <div className={cn("relative h-full min-h-[inherit] w-full", shellClassName)}>
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
        <div className="relative z-[1]" data-overlay-content-block>
          {children}
        </div>
      </div>
    </AdaptiveMediaFrame>
  );
}
