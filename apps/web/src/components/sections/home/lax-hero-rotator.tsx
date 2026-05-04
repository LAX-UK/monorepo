"use client";

import type { HeroSaleSlideVM } from "@/components/sections/home/home-view-models";
import { MediaImage } from "@/components/ui/media-image";
import { RevealOnMount } from "@/components/ui/reveal";
import { DisplayHeading, LabelCaps, cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { type KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";

const AUTO_MS = 7000;

type Props = {
  slides: HeroSaleSlideVM[];
};

export function LaxHeroSaleroomRotator({ slides }: Props) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduceMotion = useRef(false);
  const regionRef = useRef<HTMLElement>(null);
  const n = slides.length;

  useEffect(() => {
    reduceMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  if (n === 0) return null;

  const current = slides[index] ?? slides[0];
  if (!current) return null;

  const go = useCallback(
    (dir: -1 | 1) => {
      setIndex((i) => (i + dir + n) % n);
    },
    [n],
  );

  useEffect(() => {
    if (n <= 1 || paused || reduceMotion.current) return;
    const t = window.setInterval(() => {
      setIndex((i) => (i + 1) % n);
    }, AUTO_MS);
    return () => window.clearInterval(t);
  }, [n, paused]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(-1);
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      go(1);
    }
  };

  return (
    <section
      ref={regionRef}
      aria-roledescription="carousel"
      aria-label="Upcoming salerooms"
      // biome-ignore lint/a11y/noNoninteractiveTabindex: carousel must receive focus for ArrowLeft/ArrowRight
      tabIndex={0}
      className="relative mx-auto min-h-[min(100svh,520px)] w-full max-w-[var(--container-max,1440px)] bg-hero-cream dark:bg-surface-container-low md:min-h-[min(100svh,760px)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-gold"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => {
        if (!regionRef.current?.contains(e.relatedTarget)) setPaused(false);
      }}
      onKeyDown={onKeyDown}
    >
      <div className="relative min-h-[min(100svh,520px)] md:min-h-[min(100svh,760px)]">
        <RevealOnMount
          key={current.id}
          className="absolute inset-0 overflow-hidden"
          innerClassName="absolute inset-0"
        >
          <MediaImage
            src={current.coverImageUrl}
            alt={current.coverImageAlt}
            label="Auction cover"
            tone="dark"
            priority={index === 0}
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
        <div className="relative flex min-h-[min(100svh,520px)] flex-col justify-end px-6 pb-16 pt-32 md:min-h-[min(100svh,760px)] md:px-10 md:pb-20 lg:px-10">
          {/* biome-ignore lint/a11y/useSemanticElements: carousel slide uses WAI-ARIA group, not a form fieldset */}
          <div
            role="group"
            aria-roledescription="slide"
            aria-label={`${index + 1} of ${n}`}
            className="m-0 flex min-w-0 max-w-[684px] flex-col gap-8 border-0 p-0 md:gap-14"
          >
            <div className="flex flex-col gap-6">
              <LabelCaps className="text-base font-medium leading-6 tracking-normal text-white">
                {current.modeBadge}
              </LabelCaps>
              <DisplayHeading
                as="h1"
                className="text-4xl font-medium uppercase leading-[120%] tracking-tight text-white md:text-[60px] md:leading-[72px]"
              >
                {current.title}
              </DisplayHeading>
              <p className="font-body text-sm font-semibold uppercase tracking-wide text-white/90">
                {current.dateLabel}
              </p>
            </div>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <Button variant="cta" size="xl" className="min-h-[44px] w-fit" asChild>
                <Link href={current.href}>Open saleroom</Link>
              </Button>
              {n > 1 ? (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="min-h-[44px] min-w-[44px] border-nav-border bg-surface/80 text-brand-900 backdrop-blur-sm hover:bg-surface dark:border-outline-variant/20 dark:text-on-surface"
                    aria-label="Previous saleroom"
                    onClick={() => go(-1)}
                  >
                    <ChevronLeft aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="min-h-[44px] min-w-[44px] border-nav-border bg-surface/80 text-brand-900 backdrop-blur-sm hover:bg-surface dark:border-outline-variant/20 dark:text-on-surface"
                    aria-label="Next saleroom"
                    onClick={() => go(1)}
                  >
                    <ChevronRight aria-hidden />
                  </Button>
                </div>
              ) : null}
            </div>
            {n > 1 ? (
              // biome-ignore lint/a11y/useSemanticElements: dot toolbar is a control group, not a form fieldset
              <div className="flex flex-wrap gap-2" role="group" aria-label="Choose slide">
                {slides.map((s, i) => (
                  <Button
                    key={s.id}
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-pressed={i === index}
                    aria-label={`Slide ${i + 1} of ${n}`}
                    className={cn(
                      "h-2.5 w-2.5 min-w-0 rounded-full p-0 hover:bg-transparent motion-reduce:transition-none",
                      i === index ? "bg-brand-100" : "bg-brand-400/50 hover:bg-brand-300",
                    )}
                    onClick={() => setIndex(i)}
                  />
                ))}
              </div>
            ) : null}
            <p className="sr-only" aria-live="polite" aria-atomic="true">
              {current.title}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
