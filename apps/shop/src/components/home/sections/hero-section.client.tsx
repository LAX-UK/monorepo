"use client";

import { useReducedMotion } from "@/hooks/use-reduced-motion";
import type { HomePageViewModel } from "@/lib/home/home-page.vm";
import { FOCUS_RING } from "@auction/branding";
import { cn } from "@auction/ui";
import Image from "next/image";

type HeroSectionClientProps = {
  hero: HomePageViewModel["hero"];
};

export function HeroSectionClient({ hero }: HeroSectionClientProps) {
  const reducedMotion = useReducedMotion();

  return (
    <section
      className={cn("shop-home__hero", reducedMotion && "shop-home__hero--static")}
      aria-labelledby="hero-heading"
    >
      <div className="shop-home__hero-media" aria-hidden>
        {hero.layers.map((src, index) => (
          <Image
            key={src}
            src={src}
            alt=""
            fill
            priority={index === 0}
            className={`shop-home__hero-layer shop-home__hero-layer--${index + 1}`}
            sizes="100vw"
          />
        ))}
      </div>
      <div className="shop-home__hero-scrim" aria-hidden />
      <div className="shop-home__hero-panel">
        <h1 id="hero-heading" className="shop-home__hero-title">
          {hero.title}
        </h1>
        <p className="shop-home__hero-copy">{hero.copy}</p>
        <a href={hero.ctaHref} className={cn("shop-home__hero-cta", FOCUS_RING)}>
          {hero.ctaLabel}
        </a>
      </div>
    </section>
  );
}
