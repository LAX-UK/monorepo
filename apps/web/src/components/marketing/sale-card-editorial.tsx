"use client";

import { MarketingLinkCard } from "@/components/marketing/marketing-link-card";
import { AdaptiveFrameImage } from "@/components/ui/adaptive-frame-image";
import {
  AdaptiveMediaFrame,
  AdaptiveMediaFrameContainer,
} from "@/components/ui/adaptive-media-frame";
import { useOverlayTone } from "@/components/ui/overlay-tone-context";
import { OverlayToneText } from "@/components/ui/overlay-tone-text";
import { EDITORIAL_BOLD_SLOTS } from "@/lib/media/overlay-slot-presets";
import { toneAwareScrimStops } from "@/lib/media/tone-aware-scrim";
import { cn } from "@auction/ui";
import type { ReactNode } from "react";

export type SaleCardEditorialProps = {
  href: string;
  tone: "bold" | "calm";
  image?: ReactNode;
  adaptiveMedia?: {
    src: string | null | undefined;
    alt: string;
    sizes?: string;
  };
  title: ReactNode;
  subtitle?: ReactNode;
  className?: string;
};

function SaleEditorialBoldScrim() {
  const tone = useOverlayTone("contentBlock");
  const { strong, soft } = toneAwareScrimStops(tone.tone);
  return (
    <div
      className="pointer-events-none absolute inset-0"
      style={{
        background: `linear-gradient(to top, ${strong} 0%, ${soft} 45%, transparent 100%)`,
      }}
      aria-hidden
    />
  );
}

export function SaleCardEditorial({
  href,
  tone,
  image,
  adaptiveMedia,
  title,
  subtitle,
  className,
}: SaleCardEditorialProps) {
  if (tone === "calm") {
    return (
      <MarketingLinkCard
        href={href}
        className={cn(
          "block overflow-hidden rounded-xl border border-border-hairline bg-surface shadow-sm",
          className,
        )}
      >
        <div className="relative aspect-video bg-surface-container-low">{image}</div>
        <div className="p-6">
          {title}
          {subtitle}
        </div>
      </MarketingLinkCard>
    );
  }

  const card = (
    <MarketingLinkCard
      href={href}
      className={cn("relative block overflow-hidden rounded-xl shadow-sm", className)}
    >
      <AdaptiveMediaFrameContainer className="relative aspect-video bg-surface-container-low">
        <div className="absolute inset-0 [&_img]:size-full [&_img]:object-cover">
          {adaptiveMedia ? (
            <AdaptiveFrameImage
              src={adaptiveMedia.src}
              alt={adaptiveMedia.alt}
              objectFit="cover"
              {...(adaptiveMedia.sizes
                ? { sizes: adaptiveMedia.sizes }
                : { sizes: "(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 640px" })}
              className="size-full"
            />
          ) : (
            image
          )}
        </div>
        {adaptiveMedia ? (
          <SaleEditorialBoldScrim />
        ) : (
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-transparent"
            aria-hidden
          />
        )}
        <div
          className="absolute inset-x-0 bottom-0 z-[1] space-y-2 p-6"
          {...(adaptiveMedia ? { "data-overlay-content-block": true } : {})}
        >
          {adaptiveMedia ? (
            <>
              <OverlayToneText as="div" variant="display">
                {title}
              </OverlayToneText>
              {subtitle ? (
                <OverlayToneText as="div" variant="muted">
                  {subtitle}
                </OverlayToneText>
              ) : null}
            </>
          ) : (
            <>
              <div className="text-white">{title}</div>
              {subtitle ? <div className="text-white/80">{subtitle}</div> : null}
            </>
          )}
        </div>
      </AdaptiveMediaFrameContainer>
    </MarketingLinkCard>
  );

  if (!adaptiveMedia) return card;

  return (
    <AdaptiveMediaFrame src={adaptiveMedia.src} objectFit="cover" slots={EDITORIAL_BOLD_SLOTS}>
      {card}
    </AdaptiveMediaFrame>
  );
}
