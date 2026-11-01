"use client";

import {
  Carousel,
  CarouselContent,
  CarouselDots,
  CarouselItem,
  cn,
  useCarousel,
} from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";
import type { ReactNode } from "react";
import { MARKETING_SURFACE_TONE } from "./marketing-surface-tone.js";

export type MarketingRevealSlide = {
  key: string;
  /** Uppercase parts divided by a rule, e.g. ["Featured exhibition", "London"]. */
  eyebrow?: readonly string[];
  /** Date range and time under the eyebrow. */
  meta?: readonly string[];
  title: string;
  summary?: string | null;
  cta: { href: string; label: string };
  /** Fills the image half (`absolute inset-0 size-full`). */
  media: ReactNode;
};

export type MarketingRevealCarouselProps = {
  slides: readonly MarketingRevealSlide[];
  ariaLabel: string;
  className?: string;
};

function DividedParts({ parts, className }: { parts: readonly string[]; className?: string }) {
  return (
    <p className={cn("flex flex-wrap items-center font-label text-xs", className)}>
      {parts.map((part, index) => (
        <span
          key={part}
          className={cn(
            index > 0 && "pl-3",
            index < parts.length - 1 && "border-r border-current pr-3",
          )}
        >
          {part}
        </span>
      ))}
    </p>
  );
}

function RevealSlide({ slide }: { slide: MarketingRevealSlide }) {
  const { eyebrow = [], meta = [], title, summary, cta, media } = slide;
  return (
    <div className="mx-auto grid max-w-[90rem] items-center gap-6 px-4 py-8 sm:px-10 md:grid-cols-2 md:gap-12 md:py-12 lg:px-20">
      <div className="flex flex-col items-start gap-6 md:order-first">
        <div className="flex flex-col gap-1">
          {eyebrow.length > 0 ? <DividedParts parts={eyebrow} /> : null}
          {meta.length > 0 ? (
            <DividedParts parts={meta} className="text-on-surface-variant" />
          ) : null}
        </div>
        <h2 className="m-0 font-headline text-[length:var(--text-title-promo,clamp(1.75rem,3.2vw,2.75rem))] font-normal leading-[1.15]">
          {title}
        </h2>
        {summary ? (
          <p className="m-0 max-w-[32rem] text-base leading-relaxed text-on-surface-variant">
            {summary}
          </p>
        ) : null}
        <Button asChild variant="secondaryOutline" size="lg">
          <Link href={cta.href}>{cta.label}</Link>
        </Button>
      </div>
      <div className="relative aspect-[4/3] overflow-hidden bg-surface-container md:order-last">
        {media}
      </div>
    </div>
  );
}

/** Off-screen slides are inert so keyboard focus never lands on a slide the viewport has scrolled away. */
function CarouselSlide({
  index,
  total,
  children,
}: {
  index: number;
  total: number;
  children: ReactNode;
}) {
  const { selectedIndex } = useCarousel();
  return (
    <CarouselItem
      className="pl-0"
      aria-label={`${index + 1} of ${total}`}
      inert={index !== selectedIndex}
    >
      {children}
    </CarouselItem>
  );
}

/**
 * Split-slide hero (Figma "Reveal", `561:7003`): copy on one half, image on the other, dots
 * below. It never autoplays, so there is no motion to suppress for `prefers-reduced-motion`;
 * slides change only on swipe or dot press. One slide renders statically, with no dots.
 */
export function MarketingRevealCarousel({
  slides,
  ariaLabel,
  className,
}: MarketingRevealCarouselProps) {
  const surface = cn(MARKETING_SURFACE_TONE.feature.surface, className);
  const [only] = slides;
  if (!only) return null;
  if (slides.length === 1) {
    return (
      <section aria-label={ariaLabel} className={surface}>
        <RevealSlide slide={only} />
      </section>
    );
  }
  return (
    <div className={surface}>
      <Carousel aria-label={ariaLabel} opts={{ loop: false }}>
        <CarouselContent className="ml-0">
          {slides.map((slide, index) => (
            <CarouselSlide key={slide.key} index={index} total={slides.length}>
              <RevealSlide slide={slide} />
            </CarouselSlide>
          ))}
        </CarouselContent>
        <CarouselDots
          className="justify-center pb-8"
          dotClassName="relative h-2.5! min-h-0! after:absolute after:-inset-x-1 after:-inset-y-4"
          activeClassName="w-10! bg-on-surface"
          inactiveClassName="w-2.5! bg-on-surface/30 hover:bg-on-surface/50"
        />
      </Carousel>
    </div>
  );
}
