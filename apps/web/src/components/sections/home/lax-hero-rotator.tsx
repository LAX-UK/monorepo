"use client";

import type { HeroSaleSlideVM } from "@/components/sections/home/home-view-models";
import { MaterialIcon } from "@/components/ui/material-icon";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { DisplayHeading, LabelCaps } from "@auction/ui";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

const AUTO_MS = 7000;

type Props = {
  slides: HeroSaleSlideVM[];
};

export function LaxHeroSaleroomRotator({ slides }: Props) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduceMotion = useRef(false);
  const regionRef = useRef<HTMLDivElement>(null);
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

  const onKeyDown = (e: React.KeyboardEvent) => {
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
    <section className="relative w-full bg-hero-cream dark:bg-surface-container-low">
      <div
        ref={regionRef}
        role="region"
        aria-roledescription="carousel"
        aria-label="Upcoming salerooms"
        tabIndex={0}
        className="relative mx-auto min-h-[min(100svh,520px)] w-full max-w-[var(--container-max,1440px)] outline-none md:min-h-[min(100svh,760px)]"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={(e) => {
          if (!regionRef.current?.contains(e.relatedTarget)) setPaused(false);
        }}
        onKeyDown={onKeyDown}
      >
        <div className="relative min-h-[min(100svh,520px)] md:min-h-[min(100svh,760px)]">
          {current.coverImageUrl ? (
            <Image
              key={current.id}
              src={current.coverImageUrl}
              alt={current.coverImageAlt}
              fill
              priority={index === 0}
              fetchPriority={index === 0 ? "high" : "auto"}
              className={cn(
                "object-cover object-center transition-opacity duration-500 motion-reduce:transition-none",
              )}
              sizes="100vw"
            />
          ) : (
            <div
              key={`empty-${current.id}`}
              className="absolute inset-0 bg-brand-900/20 dark:bg-surface-container-high"
              aria-hidden
            />
          )}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(to right, var(--color-scrim-hero), var(--color-scrim-hero-mid), transparent)",
            }}
            aria-hidden
          />
          <div className="relative flex min-h-[min(100svh,520px)] flex-col justify-end px-6 pb-16 pt-32 md:min-h-[min(100svh,760px)] md:px-10 md:pb-20 lg:px-10">
            <div
              role="group"
              aria-roledescription="slide"
              aria-label={`Slide ${index + 1} of ${n}`}
              className="flex max-w-[684px] flex-col gap-8 md:gap-14"
            >
              <div className="flex flex-col gap-6">
                <LabelCaps className="text-base font-medium leading-6 tracking-normal text-brand-100">
                  {current.modeBadge}
                </LabelCaps>
                <DisplayHeading
                  as="h1"
                  className="text-4xl font-medium uppercase leading-[120%] tracking-tight text-hero-foreground md:text-[60px] md:leading-[72px]"
                >
                  {current.title}
                </DisplayHeading>
                <p className="font-body text-sm font-semibold uppercase tracking-wide text-brand-200">
                  {current.dateLabel}
                </p>
              </div>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <Button variant="cta" size="xl" className="min-h-[44px] w-fit" asChild>
                  <Link href={current.href}>Open saleroom</Link>
                </Button>
                {n > 1 ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-nav-border bg-surface/80 text-brand-900 backdrop-blur-sm transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-gold dark:border-outline-variant/20 dark:text-on-surface"
                      aria-label="Previous saleroom"
                      onClick={() => go(-1)}
                    >
                      <MaterialIcon name="chevron_left" />
                    </button>
                    <button
                      type="button"
                      className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-nav-border bg-surface/80 text-brand-900 backdrop-blur-sm transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-gold dark:border-outline-variant/20 dark:text-on-surface"
                      aria-label="Next saleroom"
                      onClick={() => go(1)}
                    >
                      <MaterialIcon name="chevron_right" />
                    </button>
                  </div>
                ) : null}
              </div>
              {n > 1 ? (
                <div className="flex flex-wrap gap-2" role="tablist" aria-label="Slide indicators">
                  {slides.map((s, i) => (
                    <button
                      key={s.id}
                      type="button"
                      role="tab"
                      aria-selected={i === index}
                      aria-label={`Go to slide ${i + 1}`}
                      className={cn(
                        "h-2.5 w-2.5 rounded-full transition-colors motion-reduce:transition-none",
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
      </div>
    </section>
  );
}
