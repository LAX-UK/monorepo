"use client";

import {
  AdaptiveMediaFrame,
  AdaptiveMediaFrameContainer,
} from "@/components/ui/adaptive-media-frame";
import { HeroCoverImage } from "@/components/ui/hero-cover-image";
import type { HeroCoverSources } from "@/lib/media/hero-cover-sources";
import { HERO_IMMERSIVE_SLOTS } from "@/lib/media/overlay-slot-presets";
import { cn } from "@auction/ui";
import type { ReactNode } from "react";

type Props = {
  cover: HeroCoverSources;
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
  cover,
  alt,
  sizes,
  priority = false,
  imgClassName,
  backdropScrim,
  className,
  shellClassName,
  children,
}: Props) {
  return (
    <AdaptiveMediaFrame
      src={cover.desktopUrl}
      objectFit="cover"
      slots={HERO_IMMERSIVE_SLOTS}
      {...(className ? { className } : {})}
    >
      <div className={cn("relative h-full min-h-[inherit] w-full", shellClassName)}>
        <AdaptiveMediaFrameContainer className="absolute inset-0 overflow-hidden bg-surface-container-high">
          <HeroCoverImage
            cover={cover}
            alt={alt}
            {...(sizes ? { sizes } : {})}
            priority={priority}
            className="h-full w-full"
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
