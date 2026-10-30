import { ArtEditorialLink } from "@/components/editorial/art-editorial-link";
import { ArtHeroSignal } from "@/components/header/art-hero-signal.client";
import { ArtMediaImage } from "@/components/media/art-media-image";
import type { ArtHomeHeroVm } from "@/lib/home/art-home-hero.vm";
import { ART_HERO_UNDER_HEADER_CLASS } from "@/lib/layout/art-header-chrome.vm";
import { MARKETING_PAGE_SHELL } from "@auction/branding";
import { MarketingArrowRightIcon } from "@auction/marketing-ui";
import { cn } from "@auction/ui";

/** Full-bleed photograph with the cream glass panel from the LAX.art home frame (Figma 473:8994). */
export function ArtHomeHero({ hero }: { hero: ArtHomeHeroVm }) {
  return (
    <section
      aria-labelledby="art-home-title"
      className={cn(
        "relative isolate flex min-h-[clamp(30rem,72svh,36.625rem)] overflow-hidden bg-brand-obsidian lg:min-h-[min(50rem,100svh)]",
        ART_HERO_UNDER_HEADER_CLASS,
      )}
    >
      <ArtHeroSignal />
      <div aria-hidden className="absolute inset-0 -z-10 motion-safe:animate-art-hero-drift">
        <ArtMediaImage
          src={hero.imageUrl}
          alt=""
          priority
          sizes="100vw"
          className="size-full"
          imgClassName="object-cover"
        />
      </div>
      <div className={cn(MARKETING_PAGE_SHELL, "flex items-end pt-24 pb-10 sm:pb-16")}>
        <div className="flex w-full max-w-[37.5rem] flex-col gap-4 border border-hero-panel-border bg-hero-panel p-5 backdrop-blur-sm motion-safe:animate-art-hero-panel-in sm:gap-3 sm:p-10">
          <div className="flex flex-col gap-3">
            {hero.kicker ? (
              <p className="font-label text-xs text-hero-panel-ink">{hero.kicker}</p>
            ) : null}
            <h1
              id="art-home-title"
              className="font-headline text-xl leading-[1.65rem] font-semibold text-hero-panel-ink sm:text-[1.875rem] sm:leading-8"
            >
              {hero.headline}
            </h1>
            <p className="font-body text-xs leading-[1.125rem] text-hero-panel-body sm:text-base sm:leading-6 sm:font-medium">
              {hero.copy}
            </p>
          </div>
          <ArtEditorialLink
            href={hero.cta.href}
            className="group art-focus-ring inline-flex min-h-11 items-center gap-2 self-start rounded-sm font-label text-sm leading-[1.375rem] font-semibold text-hero-panel-cta underline decoration-1 underline-offset-4 hover:decoration-2 sm:min-h-14 sm:text-base sm:leading-6"
          >
            {hero.cta.label}
            <MarketingArrowRightIcon
              aria-hidden
              className="size-4 transition-transform motion-safe:group-hover:translate-x-0.5 sm:size-5"
            />
          </ArtEditorialLink>
        </div>
      </div>
    </section>
  );
}
