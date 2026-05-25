"use client";

import { useOverlayTone } from "@/components/ui/overlay-tone-context";
import { toneAwareHeroScrimGradient, toneAwareScrimStops } from "@/lib/media/tone-aware-scrim";
import { cn } from "@auction/ui";

type Props = {
  className?: string;
};

/** Left-heavy horizontal scrim tuned to the hero content-block overlay tone. */
export function HeroHorizontalScrim({ className }: Props) {
  const tone = useOverlayTone("contentBlock");
  return (
    <div
      className={cn("pointer-events-none absolute inset-0", className)}
      style={{ background: toneAwareHeroScrimGradient(tone.tone) }}
      aria-hidden
    />
  );
}

/** Bottom-heavy vertical scrim tuned to the content-block overlay tone. */
export function HeroVerticalScrim({ className }: Props) {
  const tone = useOverlayTone("contentBlock");
  const { strong, soft } = toneAwareScrimStops(tone.tone);
  return (
    <div
      className={cn("pointer-events-none absolute inset-0", className)}
      style={{
        background: `linear-gradient(to top, ${strong} 0%, ${soft} 45%, transparent 100%)`,
      }}
      aria-hidden
    />
  );
}
