"use client";

import {
  HERO_AUTOPLAY_MS,
  createHeroAutoplayPlugin,
} from "@/components/gallery/engine/hero-autoplay-plugin";
import { HeroDots } from "@/components/sections/home/hero/hero-dots";
import { HeroProgressBar } from "@/components/sections/home/hero/hero-progress-bar";
import { HeroSlideCopy } from "@/components/sections/home/hero/hero-slide-copy";
import type { HeroSaleSlideVM } from "@/components/sections/home/home-view-models";
import { MediaImage } from "@/components/ui/media-image";
import { RevealOnMount } from "@/components/ui/reveal";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { FOCUS_RING } from "@/lib/marketing/chrome";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  cn,
  useCarousel,
} from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

type Props = {
  slides: HeroSaleSlideVM[];
};

export function LaxHeroSaleroomRotator({ slides }: Props) {
  const n = slides.length;
  const reduceMotion = useReducedMotion();
  const [paused, setPaused] = useState(false);
  const plugins = useMemo(
    () => createHeroAutoplayPlugin(reduceMotion, HERO_AUTOPLAY_MS),
    [reduceMotion],
  );

  if (n === 0) return null;

  return (
    <Carousel
      opts={{ loop: true, align: "start" }}
      plugins={plugins}
      className={cn(
        "relative mx-auto min-h-[min(100svh,520px)] w-full max-w-[var(--container-max,1440px)] bg-hero-cream dark:bg-surface-container-low md:min-h-[min(100svh,760px)]",
        FOCUS_RING,
      )}
      aria-label="Upcoming salerooms"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPaused(false);
      }}
      tabIndex={0}
    >
      <HeroProgressWithCarousel paused={paused} active={n > 1} reduceMotion={reduceMotion} />
      <CarouselContent className="-ml-0 h-full min-h-[min(100svh,520px)] md:min-h-[min(100svh,760px)]">
        {slides.map((slide, i) => (
          <CarouselItem key={slide.id} className="basis-full pl-0">
            <HeroSlidePanel slide={slide} priority={i === 0} />
          </CarouselItem>
        ))}
      </CarouselContent>
      <HeroChrome slides={slides} />
      <CarouselPrevious className="sr-only" aria-hidden />
      <CarouselNext className="sr-only" aria-hidden />
    </Carousel>
  );
}

function HeroSlidePanel({ slide, priority }: { slide: HeroSaleSlideVM; priority: boolean }) {
  return (
    <div className="relative min-h-[min(100svh,520px)] md:min-h-[min(100svh,760px)]">
      <RevealOnMount
        key={slide.id}
        variant="wipeZoom"
        className="absolute inset-0 overflow-hidden"
        innerClassName="absolute inset-0"
      >
        <MediaImage
          src={slide.coverImageUrl}
          alt={slide.coverImageAlt}
          label="Auction cover"
          tone="dark"
          priority={priority}
          imgClassName="object-center"
          sizes="100vw"
        />
      </RevealOnMount>
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--color-scrim-hero), var(--color-scrim-hero-mid), transparent)",
        }}
        aria-hidden
      />
    </div>
  );
}

function HeroProgressWithCarousel({
  paused,
  active,
  reduceMotion,
}: {
  paused: boolean;
  active: boolean;
  reduceMotion: boolean;
}) {
  const { selectedIndex } = useCarousel();
  return (
    <HeroProgressBar
      durationMs={HERO_AUTOPLAY_MS}
      paused={paused}
      active={active}
      reduceMotion={reduceMotion}
      resetKey={selectedIndex}
    />
  );
}

function HeroChrome({ slides }: { slides: HeroSaleSlideVM[] }) {
  const { selectedIndex, scrollPrev, scrollNext } = useCarousel();
  const n = slides.length;
  const current = slides[selectedIndex] ?? slides[0];
  if (!current) return null;

  return (
    <div className="pointer-events-none absolute inset-0 flex min-h-[min(100svh,520px)] flex-col justify-end px-6 pb-16 pt-32 md:min-h-[min(100svh,760px)] md:px-10 md:pb-20 lg:px-10">
      <div className="pointer-events-auto">
        <HeroSlideCopy slide={current} slideIndex={selectedIndex} slideCount={n} />
        {n > 1 ? (
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
            <HeroNavButtons onPrev={scrollPrev} onNext={scrollNext} />
            <HeroDots />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function HeroNavButtons({ onPrev, onNext }: { onPrev: () => void; onNext: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="min-h-[44px] min-w-[44px] border-nav-border bg-surface/80 text-brand-900 backdrop-blur-sm hover:bg-surface dark:border-border-hairline dark:text-on-surface"
        aria-label="Previous saleroom"
        onClick={onPrev}
      >
        <ChevronLeft aria-hidden />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="min-h-[44px] min-w-[44px] border-nav-border bg-surface/80 text-brand-900 backdrop-blur-sm hover:bg-surface dark:border-border-hairline dark:text-on-surface"
        aria-label="Next saleroom"
        onClick={onNext}
      >
        <ChevronRight aria-hidden />
      </Button>
    </div>
  );
}
