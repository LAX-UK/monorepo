import { ArtHeroSignal } from "@/components/header/art-hero-signal.client";
import { ArtMediaImage } from "@/components/media/art-media-image";
import type { ArtworksLandingHeroVm } from "@/lib/catalogue/artworks-page.composer";
import { ART_HERO_UNDER_HEADER_CLASS } from "@/lib/layout/art-header-chrome.vm";
import { MARKETING_PAGE_SHELL } from "@auction/branding";
import { cn } from "@auction/ui";

/**
 * 500px image band with a scrim and centred title (Figma 587:9412, "Page titel" Variant2 875:19061).
 * Full-bleed, so the page renders it outside the gutter shell.
 */
export function ArtArtworksLandingHero({ hero }: { hero: ArtworksLandingHeroVm }) {
  return (
    <section
      aria-labelledby="art-artworks-landing-title"
      className={cn(
        "relative isolate flex min-h-[20rem] items-center overflow-hidden bg-brand-obsidian md:min-h-[31.25rem]",
        ART_HERO_UNDER_HEADER_CLASS,
      )}
    >
      <ArtHeroSignal />
      <div aria-hidden className="absolute inset-0 -z-10">
        <ArtMediaImage
          src={hero.imageUrl}
          alt=""
          priority
          sizes="100vw"
          className="size-full"
          imgClassName="object-cover"
        />
        <div className="absolute inset-0 bg-scrim-hero-mid" />
      </div>
      <div
        className={cn(
          MARKETING_PAGE_SHELL,
          "flex flex-col items-center gap-4 py-16 text-center text-hero-foreground",
        )}
      >
        <h1
          id="art-artworks-landing-title"
          className="font-headline text-[length:var(--text-title-section)] font-medium leading-tight"
        >
          {hero.title}
        </h1>
        <p className="max-w-xl font-body text-sm leading-6 md:text-base">{hero.description}</p>
      </div>
    </section>
  );
}
